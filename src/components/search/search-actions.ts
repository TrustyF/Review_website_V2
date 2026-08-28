"use server";
import { after } from "next/server";
import Fuse from "fuse.js";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType } from "@prisma/client";
// Imported from asset-paths.ts directly (not poster-resolver.ts) so this
// server action's cold-start bundle doesn't pull in sharp's native binary —
// see asset-paths.ts's own comment for why that matters here specifically.
import { toPersonPhotoSrc, toPosterSrc } from "@/server/resolvers/asset-paths";
import { getLocalDiskStorage } from "@/server/storage/image-storage";
import { hasPhotoEligibleRole } from "@/server/resolvers/person-photo-eligibility";

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

// Same typo tolerance as everywhere else fuzzy search happens in this app
// (list-actions.ts, the old per-page search) — 0.35 survives a couple of
// wrong/missing letters without turning every query into a firehose of
// unrelated results. All three entry kinds below share the "title" key (a
// person's or company's own name, aliased to it — see SearchablePerson and
// SearchableCompany) so one Fuse index ranks media, people, and companies
// against each other directly instead of running separate searches and
// interleaving results after the fact.
const FUSE_OPTIONS = {
	keys: [
		{ name: "title", weight: 0.7 },
		{ name: "alternateTitle", weight: 0.3 },
	],
	threshold: 0.35,
	ignoreLocation: true,
	// Needed so searchAllMedia's person re-ranking can see how good a match
	// each result actually was, not just that it cleared `threshold` — off by
	// default in Fuse.js.
	includeScore: true,
};

type SearchableMedia = {
	kind: "media";
	id: number;
	title: string;
	alternateTitle: string | null;
	type: MediaType;
	posterPath: string | null;
	releaseDate: Date | null;
};

type SearchablePerson = {
	kind: "person";
	id: number;
	// Aliased from Person.name — see FUSE_OPTIONS's own comment on why every
	// entry kind shares this one key instead of person entries using their
	// own "name" key.
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

// Priority order for which of a person's own credited roles gets featured
// as their headline in search results — notability-based, not frequency-
// based: someone who's directed one film and acted in ten others should
// still read as "Director", not "Actor". Covers every source's role names,
// not just TMDB's (MangaDex/ComicVine/Google Books use Author/Artist/
// Publisher; IGDB uses Developer/Publisher) since the person pool here spans
// all of them. Falls back to whatever role they actually have if none of
// these match (a job title obscure enough to not be worth special-casing).
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

// Module-scope, so it's shared across every debounced keystroke of the same
// typing session (and every visitor, while this server instance stays warm)
// instead of a fresh ~150-200ms DB round trip plus a Fuse index rebuild on
// every one of them — that per-keystroke cost was the actual "slow,
// unresponsive" search bar complaint this was added for. On Vercel Fluid,
// module-scope memory is per-instance, and instances churn far more often
// than a human typing session lasts — a short TTL was mostly just forcing a
// rebuild (DB fetch + Fuse indexing, the CPU-heavy part) on close to every
// cold instance's first search, which is pure Active CPU cost for no
// freshness anyone asked for. This collection only changes via admin edits
// and ingest runs — both rare — so the TTL here is just a safety net; the
// actions that actually change what search should show (saveMediaDetails,
// setMediaDeleted, hardDeleteMedia, createManualMedia) call
// invalidateSearchIndex() directly for immediate freshness on the instance
// that served the edit. Ingest scripts run as a separate process, so they
// can't reach this module-scope cache either way — the TTL is what bounds
// staleness for those.
let cachedIndex: { fuse: Fuse<SearchableEntry>; expiresAt: number } | null =
	null;
const CACHE_TTL_MS = 60 * 60_000;

// How long the *durable* blob is trusted before being treated as a miss.
// Kept far longer than CACHE_TTL_MS on purpose: every edit path that actually
// changes what search should show (saveMediaDetails, setMediaDeleted,
// hardDeleteMedia, createManualMedia) already calls invalidateSearchIndex()
// directly, so this TTL isn't what keeps the durable copy fresh day-to-day —
// it's purely a safety net for the ingest script, which runs as a separate
// process and can't call invalidateSearchIndex() either. A short TTL here
// just meant the first search after any >1hr traffic gap (e.g. overnight)
// paid a full DB-query-plus-Fuse-build instead of the much cheaper durable
// read — see getSearchIndex's own comment on why that gap matters more than
// it looks like it should on a cold, un-JIT-warmed instance.
const DURABLE_TTL_MS = 3 * 24 * 60 * 60_000;

// Originally this measured ~850ms in production (media-plus-credits-join
// query) without Vercel Fluid Compute's warm-instance reuse — every cold
// instance paid the full DB-query-plus-Fuse-build path, so the result was
// persisted through R2 for the next cold instance to read back cheaply
// instead of hitting the database again. Now that the app is one long-lived
// self-hosted container (see docker-compose.yml) rather than many churning
// serverless instances, that cross-instance sharing problem doesn't exist —
// this is kept on disk mainly so the build-time rebuild (build-search-
// index.ts, baked into the image) is already warm for this container's
// whole life, and so a runtime invalidation doesn't cost every subsequent
// search a fresh DB round trip. getLocalDiskStorage() (not getImageStorage())
// on purpose — this never needs R2's durability or a public URL, just a
// local file that outlives this one process.
const PERSISTED_INDEX_DIR = "search-index";
const PERSISTED_INDEX_FILENAME = "media.json";

// Bumped any time SearchableEntry's own shape *or* the persisted payload's
// shape changes (last: adding the serialized `fuseIndex` alongside `items`).
// Without this, a blob written by an older deploy — still sitting on disk,
// still inside its own DURABLE_TTL_MS window — would get read back
// and trusted as-is: a schema change like an added/renamed field wouldn't
// necessarily throw during JSON.parse, it'd just silently produce
// wrong-shaped SearchableEntry objects (e.g. `kind: undefined`, matching
// neither branch of the "media" | "person" union) fed straight into Fuse and
// into searchAllMedia's own kind-based mapping — a real instance of this
// shipped a build where every result rendered as a person, movies included,
// because old blobs had no `kind` field to match "media" against. A version
// mismatch is treated exactly like the TTL/corrupt-JSON cases below: just
// another reason to treat this as a miss and rebuild from the DB.
const PERSISTED_INDEX_VERSION = 5;

// JSON has no Date type — a media entry's releaseDate round-trips as an ISO
// string (or null) on either side of read/writePersistedIndex instead;
// person and company entries pass through unchanged.
type PersistedSearchEntry =
	| (Omit<SearchableMedia, "releaseDate"> & { releaseDate: string | null })
	| SearchablePerson
	| SearchableCompany;

// The Fuse index built from `items` (Fuse.createIndex(...).toJSON()),
// persisted alongside the raw items so a cold instance can hand it straight
// to `Fuse.parseIndex()` instead of re-tokenizing and re-scoring all ~24k
// title/alternateTitle strings itself. This is the expensive part of
// getSearchIndex's cold path (see its own comment) — cheap to skip since
// it's pure derived data from `items`, so it round-trips through JSON same
// as everything else here.
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

// null on a cache miss (nothing written yet) *or* a stale hit (older than
// DURABLE_TTL_MS — see that constant's own comment on why it's now far
// longer than the module-scope cache's TTL). Also swallows a
// corrupt/unparseable blob as a miss, same as every ImageStorage backend's
// own read() already does for its bytes.
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
	// Built once here (not read back from a live Fuse instance) so this
	// function works the same way whether it's backfilling after a DB miss or
	// running from the build-time script, which never constructs a live Fuse
	// instance of its own.
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

// Called by the admin actions that change title/overview/isDeleted/DONE
// status — the fields this index is actually built from. Clears this
// process's module-scope cache immediately and removes the on-disk copy so a
// restart right after an edit can't resurrect the pre-edit data — the next
// getSearchIndex() call pays one DB rebuild and re-persists a fresh copy,
// same one-time cost as before this durable cache existed.
export async function invalidateSearchIndex() {
	cachedIndex = null;
	await getLocalDiskStorage().remove(
		PERSISTED_INDEX_DIR,
		PERSISTED_INDEX_FILENAME,
	);
	logSearchIndexEvent({ invalidated: true });
}

// Called from build-search-index.ts's build-time script, so the durable
// copy is already warm by the time the first real visitor searches — without
// this, that visitor's request is the one that pays the DB-query-plus-Fuse-
// build cost readPersistedIndex()'s miss path describes, on every fresh
// deploy (a new persisted blob's builtAt always starts past CACHE_TTL_MS
// worth of prior deploys). Always rebuilds from the DB rather than trusting
// whatever's already persisted — the point of running this at build time is
// a guaranteed-fresh copy, not just filling a cache.
export async function rebuildPersistedSearchIndex(): Promise<number> {
	const items = await fetchSearchEntriesFromDb();
	await writePersistedIndex(items);
	cachedIndex = null;
	logSearchIndexEvent({ rebuiltAtBuild: true, itemCount: items.length });
	return items.length;
}

// CPU time (not wall clock) is what Vercel's Fluid "Active CPU" metric
// bills, so process.cpuUsage() deltas are the closest thing to profiling
// that cost directly from inside the app. Grep Vercel logs for
// "[search-index]" to see rebuild frequency (cacheHit:false lines) and cost
// (cpuMs) — e.g. before/after changing CACHE_TTL_MS.
function logSearchIndexEvent(event: Record<string, unknown>) {
	console.log("[search-index]", JSON.stringify(event));
}

// Three independent queries rather than one media-with-credits-join like this
// used to be — a person or company surfaces as its own result now (see
// GlobalSearchResult's "person"/"company" variants) instead of just nudging a
// media item's own relevance, so there's no join left to do here. Only
// people/companies credited on at least one DONE, non-deleted media are
// included — otherwise a search could surface an entity whose only work here
// is still PENDING or deleted, a dead end with nothing to actually show for
// it.
async function fetchSearchEntriesFromDb(): Promise<SearchableEntry[]> {
	const [mediaRows, personRows, companyRows] = await Promise.all([
		dbPublic.media.findMany({
			where: { enrichmentStatus: EnrichmentStatus.DONE },
			select: {
				id: true,
				title: true,
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
				// Every DONE, non-deleted credit this person has, one row per
				// credit (not deduped by role) — needed for both the credit count
				// shown in search results and, via each row's own role name, both
				// mainRoleFor's priority pick and photo eligibility (see
				// person-photo-eligibility.ts). A duplicate role name across
				// multiple credits doesn't affect either of those, so there's no
				// need to dedupe here just to save a few rows.
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
				// Same reasoning as Person.credits above — every DONE, non-deleted
				// credit, one row per credit, feeding both creditCount and
				// mainRoleFor.
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
			// null (not the real photoPath) for a person whose only credited
			// roles aren't photo-eligible — see person-photo-eligibility.ts for
			// why this check lives here rather than at ingest.
			photoPath: hasPhotoEligibleRole(roleNames) ? p.photoPath : null,
			mainRole: mainRoleFor(roleNames),
			creditCount: p.credits.length,
		};
	});

	// Has an eligible photo first, most-credited second — see searchAllMedia's
	// own comment on why this ordering (not just Fuse's fuzzy text score) is
	// what actually decides which specific people fill the person slots in
	// the final results. Someone with a real photo reads as a more concrete,
	// "yes this is who you mean" result than a bare name, so that beats raw
	// credit count rather than just breaking ties within it.
	const personEntries: SearchableEntry[] = [...unsortedPersonEntries].sort(
		(a, b) =>
			Number(b.photoPath != null) - Number(a.photoPath != null) ||
			b.creditCount - a.creditCount,
	);

	// No photo signal to sort by (Company has no logo-in-search concept yet —
	// see credit-media-list-page.tsx, which doesn't render Company.logoPath
	// either), so most-credited first is the only notability signal available.
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

	// A miss here means either the very first search anywhere since the last
	// invalidation, or the durable copy aged past DURABLE_TTL_MS — either way,
	// this instance eats the DB queries once and re-persists a fresh copy
	// (after() — see poster-resolver.ts's resolvePoster for the same
	// "return fast, write the durable copy off the response's critical path"
	// shape) so the *next* cold instance's readPersistedIndex() above hits
	// instead of also going to the DB.
	const searchable = persisted?.items ?? (await fetchSearchEntriesFromDb());
	if (!persisted) {
		after(() => writePersistedIndex(searchable));
	}

	// On a durable hit, hand Fuse the already-tokenized index instead of
	// letting the constructor derive one from `searchable` itself — that
	// re-tokenize-and-score pass over every title/alternateTitle is the actual
	// cold-instance cost this whole persistence scheme exists to avoid (see
	// SerializedFuseIndex's own comment), and it's pure derived data, so
	// there's nothing lost by skipping it.
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

// Media/people/company fuzzy search across the whole collection, for the
// navbar's jump-to-anything search — unlike MediaFilterGrid's old per-page
// search, this isn't scoped to one type or one already-loaded list. A quick
// "jump to a title (or a person)" tool doesn't need overview-text matches
// the way the old per-page search did, so that field isn't fetched here at
// all — keeps the per-keystroke payload lighter.
export async function searchAllMedia(
	query: string,
): Promise<GlobalSearchResult[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	// Brackets the *whole* action, not just getSearchIndex() — its own
	// [search-index] log only covers building/loading the Fuse index, not the
	// fuse.search() call below or the person-reranking after it. If the
	// network tab's total is still much bigger than [search-index]'s totalMs,
	// this log is what tells us whether the gap is inside this function (e.g.
	// fuse.search() itself paying the same cold-JIT tax getSearchIndex's own
	// indexMs used to) or genuinely outside it (Next's own server action
	// invocation/cold-start overhead, network, etc.) — the two need very
	// different fixes.
	const actionStartedAt = performance.now();

	const fuse = await getSearchIndex();
	const indexReadyAt = performance.now();
	const matches = fuse.search(trimmed);
	const searchDoneAt = performance.now();

	// Fuse's own score already decided which entries are relevant matches at
	// all, and where each one ranks against the media entries around it —
	// that positioning is left alone. Among *people*, though, pure fuzzy
	// string similarity is a weak notability signal: two matches that are
	// both clearly good/bad hits for the query should stay ordered by how
	// well they actually match, but two matches that are roughly equally
	// good/bad hits are more usefully broken by (has a real photo, then
	// credit count) than by Fuse's score, which is sensitive to overall
	// string length rather than who's actually notable. So the person
	// *slots* Fuse produced stay where they are, but which specific person
	// fills each one is decided by score first, only falling back to
	// notability to break a near-tie.
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

	// Same idea as the person reranking above, minus the photo signal (Company
	// has no logo-in-search concept — see fetchSearchEntriesFromDb's own
	// comment on companyEntries): credit count breaks a near-tie in fuzzy
	// match quality, but never overrides a genuinely better/worse text match.
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
		.slice(0, SEARCH_LIMIT)
		.map(({ item }): GlobalSearchResult => {
			switch (item.kind) {
				case "media":
					return {
						kind: "media",
						id: item.id,
						title: item.title,
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
