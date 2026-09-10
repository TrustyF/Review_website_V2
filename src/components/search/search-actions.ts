"use server";
import { after } from "next/server";
import Fuse from "fuse.js";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType } from "@prisma/client";
// Import asset-paths (not poster-resolver) to avoid sharp binary.
import { toPersonPhotoSrc, toPosterSrc } from "@/server/resolvers/asset-paths";
import { getLocalDiskStorage } from "@/server/storage/image-storage";
import { hasPhotoEligibleRole } from "@/server/resolvers/person-photo-eligibility";
import { getLocale } from "@/lib/i18n/get-locale";

export type GlobalSearchResult =
	| {
			kind: "media";
			id: number;
			title: string;
			type: MediaType;
			posterSrc: string;
			releaseDate: Date | null;
	  }
	| {
			kind: "person";
			id: number;
			name: string;
			photoSrc: string | null;
			// Their single most notable credited role — see mainRoleFor's own
			// comment for how "most notable" is decided.
			mainRole: string;
			// Every DONE, non-deleted credit they have, any role — not just the
			// ones counted toward mainRole.
			creditCount: number;
	  }
	| {
			kind: "company";
			id: number;
			name: string;
			// Same mainRoleFor pick as person entries (Studio/Developer/Publisher
			// are the only role names a Company ever carries — see crew.prisma).
			mainRole: string;
			creditCount: number;
	  };

const SEARCH_LIMIT = 8;

// 0.35 threshold balances typo tolerance; unified Fuse index ranks media, people, companies.
const FUSE_OPTIONS = {
	keys: [
		{ name: "title", weight: 0.7 },
		{ name: "alternateTitle", weight: 0.3 },
		// Lets a French title be searched by even though display priority
		// (English vs. French) is decided later, per-request, in searchAllMedia.
		{ name: "titleFr", weight: 0.3 },
	],
	threshold: 0.35,
	ignoreLocation: true,
	// Enables person re-ranking by match quality (off by default in Fuse.js)
	includeScore: true,
};

type SearchableMedia = {
	kind: "media";
	id: number;
	title: string;
	titleFr: string | null;
	alternateTitle: string | null;
	type: MediaType;
	posterPath: string | null;
	releaseDate: Date | null;
};

type SearchablePerson = {
	kind: "person";
	id: number;
	// Aliased from Person.name. See FUSE_OPTIONS comment on why all entry kinds share one key (not person-specific "name").
	title: string;
	photoPath: string | null;
	mainRole: string;
	creditCount: number;
};

type SearchableCompany = {
	kind: "company";
	id: number;
	// Aliased from Company.name, same reasoning as SearchablePerson's title.
	title: string;
	mainRole: string;
	creditCount: number;
};

type SearchableEntry = SearchableMedia | SearchablePerson | SearchableCompany;

// Director > Actor; covers all sources (MangaDex/ComicVine/IGDB).
const ROLE_LABEL_PRIORITY = [
	"Director",
	"Writer",
	"Screenplay",
	"Creator",
	"Author",
	"Developer",
	"Story",
	"Artist",
	"Studio",
	"Publisher",
	"Executive Producer",
	"Producer",
	"Actor",
];

function mainRoleFor(roleNames: string[]): string {
	for (const role of ROLE_LABEL_PRIORITY) {
		if (roleNames.includes(role)) return role;
	}
	return roleNames[0] ?? "Person";
}

// Module-scope cache persists across requests; admin edits call invalidateSearchIndex().
// Ingest scripts rely on TTL since they can't reach this module-scope cache.
let cachedIndex: { fuse: Fuse<SearchableEntry>; expiresAt: number } | null =
	null;
const CACHE_TTL_MS = 60 * 60_000;

// Durable blob TTL safety net for ingest script; short TTL avoids cold-start penalty
const DURABLE_TTL_MS = 3 * 24 * 60 * 60_000;

// Originally persisted via R2 for cold Vercel instance reuse. Now self-hosted (long-lived container), kept on disk for build-time warmth and runtime invalidation cheapness.
const PERSISTED_INDEX_DIR = "search-index";
const PERSISTED_INDEX_FILENAME = "media.json";

// Bumped on SearchableEntry or payload shape change; prevents silent
// corruption from stale blobs (e.g., missing `kind` field).
const PERSISTED_INDEX_VERSION = 6;

// JSON serialization: releaseDate becomes ISO string; person/company entries pass through.
type PersistedSearchEntry =
	| (Omit<SearchableMedia, "releaseDate"> & { releaseDate: string | null })
	| SearchablePerson
	| SearchableCompany;

// Persisted Fuse index lets cold instances skip re-tokenizing (the expensive part)
type SerializedFuseIndex = ReturnType<
	ReturnType<typeof Fuse.createIndex<SearchableEntry>>["toJSON"]
>;

type PersistedSearchIndex = {
	version: number;
	builtAt: number;
	items: PersistedSearchEntry[];
	fuseIndex: SerializedFuseIndex;
};

function toPersisted(entry: SearchableEntry): PersistedSearchEntry {
	if (entry.kind !== "media") return entry;
	return {
		...entry,
		releaseDate: entry.releaseDate ? entry.releaseDate.toISOString() : null,
	};
}

function fromPersisted(entry: PersistedSearchEntry): SearchableEntry {
	if (entry.kind !== "media") return entry;
	return {
		...entry,
		releaseDate: entry.releaseDate ? new Date(entry.releaseDate) : null,
	};
}

// null on miss (nothing written) or stale hit (older than DURABLE_TTL_MS). Also swallows corrupt/unparseable blob, same as ImageStorage.read().
async function readPersistedIndex(): Promise<{
	items: SearchableEntry[];
	fuseIndex: SerializedFuseIndex;
} | null> {
	try {
		const bytes = await getLocalDiskStorage().read(
			PERSISTED_INDEX_DIR,
			PERSISTED_INDEX_FILENAME,
		);
		if (!bytes) return null;

		const parsed: PersistedSearchIndex = JSON.parse(bytes.toString("utf-8"));
		if (parsed.version !== PERSISTED_INDEX_VERSION) return null;
		if (parsed.builtAt + DURABLE_TTL_MS <= Date.now()) return null;

		return {
			items: parsed.items.map(fromPersisted),
			fuseIndex: parsed.fuseIndex,
		};
	} catch {
		return null;
	}
}

async function writePersistedIndex(items: SearchableEntry[]): Promise<void> {
// Built once (not from live Fuse); works for DB miss or script.
	const fuseIndex = Fuse.createIndex(FUSE_OPTIONS.keys, items).toJSON();
	const payload: PersistedSearchIndex = {
		version: PERSISTED_INDEX_VERSION,
		builtAt: Date.now(),
		items: items.map(toPersisted),
		fuseIndex,
	};
	await getLocalDiskStorage().write(
		PERSISTED_INDEX_DIR,
		PERSISTED_INDEX_FILENAME,
		Buffer.from(JSON.stringify(payload)),
	);
}

// Called by admin actions on title/overview/isDeleted/DONE; clears module-scope and on-disk.
export async function invalidateSearchIndex() {
	cachedIndex = null;
	await getLocalDiskStorage().remove(
		PERSISTED_INDEX_DIR,
		PERSISTED_INDEX_FILENAME,
	);
	logSearchIndexEvent({ invalidated: true });
}

// Build-time rebuild ensures durable copy is fresh before first visitor
export async function rebuildPersistedSearchIndex(): Promise<number> {
	const items = await fetchSearchEntriesFromDb();
	await writePersistedIndex(items);
	cachedIndex = null;
	logSearchIndexEvent({ rebuiltAtBuild: true, itemCount: items.length });
	return items.length;
}

// CPU time (not wall clock) bills Vercel's Fluid metric. process.cpuUsage() deltas profile cost. Grep Vercel logs for "[search-index]" to see rebuild frequency/cost.
function logSearchIndexEvent(event: Record<string, unknown>) {
	console.log("[search-index]", JSON.stringify(event));
}

// Three independent queries; people/companies surface as own results,
// only if credited on DONE non-deleted media.
async function fetchSearchEntriesFromDb(): Promise<SearchableEntry[]> {
	const [mediaRows, personRows, companyRows] = await Promise.all([
		dbPublic.media.findMany({
			where: { enrichmentStatus: EnrichmentStatus.DONE },
			select: {
				id: true,
				title: true,
				titleFr: true,
				alternateTitle: true,
				type: true,
				posterPath: true,
				releaseDate: true,
			},
			orderBy: { id: "asc" },
		}),
		db.person.findMany({
			where: {
				credits: {
					some: {
						media: {
							enrichmentStatus: EnrichmentStatus.DONE,
							isDeleted: false,
						},
					},
				},
			},
			select: {
				id: true,
				name: true,
				photoPath: true,
				// All credits per role (not deduped) for credit count and role/photo eligibility.
				credits: {
					where: {
						media: {
							enrichmentStatus: EnrichmentStatus.DONE,
							isDeleted: false,
						},
					},
					select: { role: { select: { name: true } } },
				},
			},
			orderBy: { id: "asc" },
		}),
		db.company.findMany({
			where: {
				credits: {
					some: {
						media: {
							enrichmentStatus: EnrichmentStatus.DONE,
							isDeleted: false,
						},
					},
				},
			},
			select: {
				id: true,
				name: true,
				// Every non-deleted credit, one row per credit (feeds creditCount and mainRoleFor)
				credits: {
					where: {
						media: {
							enrichmentStatus: EnrichmentStatus.DONE,
							isDeleted: false,
						},
					},
					select: { role: { select: { name: true } } },
				},
			},
			orderBy: { id: "asc" },
		}),
	]);

	const mediaEntries: SearchableEntry[] = mediaRows.map((m) => ({
		kind: "media",
		...m,
	}));

	const unsortedPersonEntries: SearchablePerson[] = personRows.map((p) => {
		const roleNames = p.credits.map((c) => c.role.name);
		return {
			kind: "person",
			id: p.id,
			title: p.name,
			// null (not real photoPath) for person without photo-eligible roles. See person-photo-eligibility.ts for why check lives here, not ingest.
			photoPath: hasPhotoEligibleRole(roleNames) ? p.photoPath : null,
			mainRole: mainRoleFor(roleNames),
			creditCount: p.credits.length,
		};
	});

// Photo first, most-credited second; photo > credit count.
	const personEntries: SearchableEntry[] = [...unsortedPersonEntries].sort(
		(a, b) =>
			Number(b.photoPath != null) - Number(a.photoPath != null) ||
			b.creditCount - a.creditCount,
	);

	// No logo concept yet, so sort by most-credited for notability.
	const companyEntries: SearchableEntry[] = companyRows
		.map((c) => {
			const roleNames = c.credits.map((cr) => cr.role.name);
			return {
				kind: "company" as const,
				id: c.id,
				title: c.name,
				mainRole: mainRoleFor(roleNames),
				creditCount: c.credits.length,
			};
		})
		.sort((a, b) => b.creditCount - a.creditCount);

	return [...mediaEntries, ...personEntries, ...companyEntries];
}

async function getSearchIndex(): Promise<Fuse<SearchableEntry>> {
	if (cachedIndex && cachedIndex.expiresAt > Date.now()) {
		logSearchIndexEvent({ cacheHit: true });
		return cachedIndex.fuse;
	}

	const cpuBefore = process.cpuUsage();
	const startedAt = performance.now();

	const persisted = await readPersistedIndex();
	const dbDoneAt = performance.now();

	// Cache miss means cold instance; persist fresh copy for next instance's fast read
	const searchable = persisted?.items ?? (await fetchSearchEntriesFromDb());
	if (!persisted) {
		after(() => writePersistedIndex(searchable));
	}

	// On durable hit, hand Fuse already-tokenized index to skip the re-tokenize-and-score pass. That's the cold-instance cost this persistence scheme avoids.
	const fuse = persisted
		? new Fuse(searchable, FUSE_OPTIONS, Fuse.parseIndex(persisted.fuseIndex))
		: new Fuse(searchable, FUSE_OPTIONS);
	const indexDoneAt = performance.now();

	const cpu = process.cpuUsage(cpuBefore);
	logSearchIndexEvent({
		cacheHit: false,
		source: persisted ? "durable" : "db",
		itemCount: searchable.length,
		dbMs: Math.round(dbDoneAt - startedAt),
		indexMs: Math.round(indexDoneAt - dbDoneAt),
		totalMs: Math.round(indexDoneAt - startedAt),
		cpuMs: Math.round((cpu.user + cpu.system) / 1000),
	});

	cachedIndex = { fuse, expiresAt: Date.now() + CACHE_TTL_MS };
	return fuse;
}

// Media/people/company fuzzy search (no overview-text for lighter payload).
export async function searchAllMedia(
	query: string,
	limit: number = SEARCH_LIMIT,
): Promise<GlobalSearchResult[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	// Falls back to English when untranslated, like Review.bodyFr/MediaTitle.
	const locale = await getLocale();

	// Brackets whole action; helps diagnose perf (inside vs. outside function).
	const actionStartedAt = performance.now();

	const fuse = await getSearchIndex();
	const indexReadyAt = performance.now();
	const matches = fuse.search(trimmed);
	const searchDoneAt = performance.now();

	// Fuse score decides relevance; notability (photo, credits) breaks person ties
	const PERSON_SCORE_TIE_THRESHOLD = 0.05; // Fuse scores 0 (perfect) to 1 (worst)
	const personSlots = matches
		.map((m, i) => (m.item.kind === "person" ? i : -1))
		.filter((i) => i !== -1);
	const peopleRanked = matches
		.filter(
			(m): m is (typeof matches)[number] & { item: SearchablePerson } =>
				m.item.kind === "person",
		)
		.sort((a, b) => {
			const scoreDiff = (a.score ?? 0) - (b.score ?? 0);
			if (Math.abs(scoreDiff) > PERSON_SCORE_TIE_THRESHOLD) return scoreDiff;
			return (
				Number(b.item.photoPath != null) - Number(a.item.photoPath != null) ||
				b.item.creditCount - a.item.creditCount
			);
		});
	personSlots.forEach((slot, i) => {
		const person = peopleRanked[i];
		if (person) matches[slot] = person;
	});

	// Like person reranking but no logo signal. Credit count breaks near-tie in fuzzy match quality, never overrides genuinely better/worse text match.
	const companySlots = matches
		.map((m, i) => (m.item.kind === "company" ? i : -1))
		.filter((i) => i !== -1);
	const companiesRanked = matches
		.filter(
			(m): m is (typeof matches)[number] & { item: SearchableCompany } =>
				m.item.kind === "company",
		)
		.sort((a, b) => {
			const scoreDiff = (a.score ?? 0) - (b.score ?? 0);
			if (Math.abs(scoreDiff) > PERSON_SCORE_TIE_THRESHOLD) return scoreDiff;
			return b.item.creditCount - a.item.creditCount;
		});
	companySlots.forEach((slot, i) => {
		const company = companiesRanked[i];
		if (company) matches[slot] = company;
	});

	const results = matches
		.slice(0, limit)
		.map(({ item }): GlobalSearchResult => {
			switch (item.kind) {
				case "media":
					return {
						kind: "media",
						id: item.id,
						title:
							locale === "fr" ? (item.titleFr ?? item.title) : item.title,
						type: item.type,
						releaseDate: item.releaseDate,
						posterSrc: toPosterSrc(item.id, item.posterPath),
					};
				case "person":
					return {
						kind: "person",
						id: item.id,
						name: item.title,
						photoSrc: toPersonPhotoSrc(item.id, item.photoPath),
						mainRole: item.mainRole,
						creditCount: item.creditCount,
					};
				case "company":
					return {
						kind: "company",
						id: item.id,
						name: item.title,
						mainRole: item.mainRole,
						creditCount: item.creditCount,
					};
			}
		});

	console.log(
		"[search-action]",
		JSON.stringify({
			query: trimmed,
			getIndexMs: Math.round(indexReadyAt - actionStartedAt),
			fuseSearchMs: Math.round(searchDoneAt - indexReadyAt),
			rerankAndMapMs: Math.round(performance.now() - searchDoneAt),
			totalMs: Math.round(performance.now() - actionStartedAt),
		}),
	);

	return results;
}
