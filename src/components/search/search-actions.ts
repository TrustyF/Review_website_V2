"use server";
import Fuse from "fuse.js";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType } from "@prisma/client";
// Import asset-paths (not poster-resolver) to avoid sharp binary.
import { toPersonPhotoSrc, toPosterSrc } from "@/server/resolvers/asset-paths";
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
	// Otherwise "amelie" only reaches "Amélie" by spending typo budget.
	ignoreDiacritics: true,
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
	// TMDB popularity (movies/TV only; null for other types). Ranking tie-breaker.
	popularity: number | null;
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

// In-memory only: rebuilding from the DB is cheap in a long-lived container. Admin edits call invalidateSearchIndex();
// standalone scripts (enrich-db cron etc.) run in another process, so they rely on the TTL.
let cachedIndex: { fuse: Fuse<SearchableEntry>; expiresAt: number } | null =
	null;
// Shared by concurrent searches that hit an expired cache, so only one rebuild runs.
let pendingIndex: Promise<Fuse<SearchableEntry>> | null = null;
const CACHE_TTL_MS = 60 * 60_000;

// People with no photo and fewer credits than this are left out of search; they're the bulk of the index and rarely searched for.
const MIN_PERSON_CREDITS_WITHOUT_PHOTO = 3;

export async function invalidateSearchIndex() {
	cachedIndex = null;
	pendingIndex = null;
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
				movie: { select: { popularity: true } },
				tvShow: { select: { popularity: true } },
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

	const mediaEntries: SearchableEntry[] = mediaRows.map(
		({ movie, tvShow, ...m }) => ({
			kind: "media",
			...m,
			popularity: movie?.popularity ?? tvShow?.popularity ?? null,
		}),
	);

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
	const personEntries: SearchableEntry[] = unsortedPersonEntries
		.filter(
			(p) =>
				p.photoPath != null ||
				p.creditCount >= MIN_PERSON_CREDITS_WITHOUT_PHOTO,
		)
		.sort(
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

function normalizeForTier(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

// Punctuation/space-free form, so "spiderman" matches "Spider-Man".
function compactForTier(text: string): string {
	return text.replace(/[^\p{L}\p{N}]+/gu, "");
}

// Returns a tier fn: 0 exact, 1 query starts at a word boundary, 2 anything else Fuse matched (mid-word, typo).
function buildTierFn(query: string): (entry: SearchableEntry) => number {
	const normalized = normalizeForTier(query);
	const compact = compactForTier(normalized);
	const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const atWordStart = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}`, "u");

	return (entry) => {
		const candidates =
			entry.kind === "media"
				? [entry.title, entry.titleFr, entry.alternateTitle]
				: [entry.title];
		let best = 2;
		for (const candidate of candidates) {
			if (!candidate) continue;
			const text = normalizeForTier(candidate);
			const textCompact = compactForTier(text);
			if (text === normalized || (compact && textCompact === compact)) return 0;
			if (
				atWordStart.test(text) ||
				(compact && textCompact.startsWith(compact))
			)
				best = 1;
		}
		return best;
	};
}

// Fuse scores 0 (perfect) to 1 (worst); scores in the same bucket count as a tie.
const SCORE_TIE_BUCKET = 0.05;

// Tie-breaker between two same-kind entries: TMDB popularity for media, photo then credits for people, credits for companies.
function notability(entry: SearchableEntry): number {
	switch (entry.kind) {
		case "media":
			return entry.popularity ?? 0;
		case "person":
			return (entry.photoPath != null ? 1e9 : 0) + entry.creditCount;
		case "company":
			return entry.creditCount;
	}
}

type ScoredEntry = { item: SearchableEntry; score?: number };

// Fuse treats any exact substring as near-perfect ("tron" ties "Astroneer" with "TRON: Legacy"), so group by lexical tier first.
// Within a tier, each kind keeps Fuse's interleaved slots but is re-sorted by score bucket, then notability.
function rankMatches<T extends ScoredEntry>(matches: T[], query: string): T[] {
	const tierOf = buildTierFn(query);
	const withTier = matches.map((match) => ({
		match,
		tier: tierOf(match.item),
	}));

	return [0, 1, 2].flatMap((tier) => {
		const group = withTier.filter((t) => t.tier === tier).map((t) => t.match);
		const sortedOfKind = (kind: SearchableEntry["kind"]) =>
			group
				.filter((m) => m.item.kind === kind)
				.sort(
					(a, b) =>
						Math.floor((a.score ?? 0) / SCORE_TIE_BUCKET) -
							Math.floor((b.score ?? 0) / SCORE_TIE_BUCKET) ||
						notability(b.item) - notability(a.item),
				);
		const queues: Record<SearchableEntry["kind"], T[]> = {
			media: sortedOfKind("media"),
			person: sortedOfKind("person"),
			company: sortedOfKind("company"),
		};
		// Each slot keeps its kind but takes that kind's next-best entry.
		return group.map((m) => queues[m.item.kind].shift() ?? m);
	});
}

async function getSearchIndex(): Promise<Fuse<SearchableEntry>> {
	if (cachedIndex && cachedIndex.expiresAt > Date.now())
		return cachedIndex.fuse;

	if (!pendingIndex) {
		const pending: Promise<Fuse<SearchableEntry>> = fetchSearchEntriesFromDb()
			.then((entries) => {
				const fuse = new Fuse(entries, FUSE_OPTIONS);
				// Invalidated mid-rebuild means these rows may predate the edit, so don't cache them.
				if (pendingIndex === pending) {
					cachedIndex = { fuse, expiresAt: Date.now() + CACHE_TTL_MS };
				}
				return fuse;
			})
			.finally(() => {
				if (pendingIndex === pending) pendingIndex = null;
			});
		pendingIndex = pending;
	}
	return pendingIndex;
}

// Media/people/company fuzzy search (no overview-text for lighter payload).
export async function searchAllMedia(
	query: string,
	limit: number | { media: number; entities: number } = SEARCH_LIMIT,
): Promise<GlobalSearchResult[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	// Falls back to English when untranslated, like Review.bodyFr/MediaTitle.
	const locale = await getLocale();

	const fuse = await getSearchIndex();
	const matches = fuse.search(trimmed);

	const ranked = rankMatches(matches, trimmed);

	// Per-kind limits stop the ~30x larger people pool from crowding media out of a shared cap.
	const limited =
		typeof limit === "number"
			? ranked.slice(0, limit)
			: [
					...ranked
						.filter((m) => m.item.kind === "media")
						.slice(0, limit.media),
					...ranked
						.filter((m) => m.item.kind !== "media")
						.slice(0, limit.entities),
				];

	const results = limited.map(({ item }): GlobalSearchResult => {
		switch (item.kind) {
			case "media":
				return {
					kind: "media",
					id: item.id,
					title: locale === "fr" ? (item.titleFr ?? item.title) : item.title,
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

	return results;
}
