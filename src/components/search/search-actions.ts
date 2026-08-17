"use server";
import { after } from "next/server";
import Fuse from "fuse.js";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType } from "@prisma/client";
// Imported from asset-paths.ts directly (not poster-resolver.ts) so this
// server action's cold-start bundle doesn't pull in sharp's native binary —
// see asset-paths.ts's own comment for why that matters here specifically.
import {
	toPersonPhotoSrc,
	toPosterSrc,
} from "@/server/resolvers/asset-paths";
import { getImageStorage } from "@/server/storage/image-storage";
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
	  };

const SEARCH_LIMIT = 8;

// Same typo tolerance as everywhere else fuzzy search happens in this app
// (list-actions.ts, the old per-page search) — 0.35 survives a couple of
// wrong/missing letters without turning every query into a firehose of
// unrelated results. Both entry kinds below share the "title" key (a
// person's own name, aliased to it — see SearchablePerson) so one Fuse
// index ranks media and people against each other directly instead of
// running two separate searches and interleaving results after the fact.
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

type SearchableEntry = SearchableMedia | SearchablePerson;

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

// Without Vercel Fluid Compute (no warm-instance reuse across requests), the
// module-scope cache above almost never hits — nearly every search pays the
// full DB-query-plus-Fuse-build cold path (measured at ~850ms in production,
// [search-index] cacheHit:false, dbMs~830, back when this was a single
// media-plus-credits-join query). Persisting the query's *result* (not the
// Fuse instance itself — that's not serializable, and rebuilding it from
// data is the cheap part anyway) through the same ImageStorage backend
// already used for posters/banners means a cold instance reads this from
// R2/Blob (a network round trip, but far cheaper than two fresh Postgres
// queries) instead of hitting the database at all. Repurposing ImageStorage
// for a JSON blob instead of image bytes is a bit of a name mismatch, but
// it's already the one abstraction in this app for "durable key-value
// storage that survives past this instance," and stood up exactly once per
// environment (IMAGE_STORAGE_DRIVER) — not worth a second storage backend
// just for this.
const PERSISTED_INDEX_DIR = "search-index";
const PERSISTED_INDEX_FILENAME = "media.json";

// Bumped any time SearchableEntry's own shape *or* the persisted payload's
// shape changes (last: adding the serialized `fuseIndex` alongside `items`).
// Without this, a blob written by an older deploy — still sitting in
// R2/Blob, still inside its own DURABLE_TTL_MS window — would get read back
// and trusted as-is: a schema change like an added/renamed field wouldn't
// necessarily throw during JSON.parse, it'd just silently produce
// wrong-shaped SearchableEntry objects (e.g. `kind: undefined`, matching
// neither branch of the "media" | "person" union) fed straight into Fuse and
// into searchAllMedia's own kind-based mapping — a real instance of this
// shipped a build where every result rendered as a person, movies included,
// because old blobs had no `kind` field to match "media" against. A version
// mismatch is treated exactly like the TTL/corrupt-JSON cases below: just
// another reason to treat this as a miss and rebuild from the DB.
const PERSISTED_INDEX_VERSION = 4;

// JSON has no Date type — a media entry's releaseDate round-trips as an ISO
// string (or null) on either side of read/writePersistedIndex instead;
// person entries pass through unchanged.
type PersistedSearchEntry =
	| (Omit<SearchableMedia, "releaseDate"> & { releaseDate: string | null })
	| SearchablePerson;

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
	if (entry.kind === "person") return entry;
	return {
		...entry,
		releaseDate: entry.releaseDate ? entry.releaseDate.toISOString() : null,
	};
}

function fromPersisted(entry: PersistedSearchEntry): SearchableEntry {
	if (entry.kind === "person") return entry;
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
		const bytes = await getImageStorage().read(
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
	await getImageStorage().write(
		PERSISTED_INDEX_DIR,
		PERSISTED_INDEX_FILENAME,
		Buffer.from(JSON.stringify(payload)),
	);
}

// Called by the admin actions that change title/overview/isDeleted/DONE
// status — the fields this index is actually built from. Clears this
// instance's module-scope cache immediately; other warm instances still
// converge via CACHE_TTL_MS rather than instantly, an acceptable gap for how
// rarely and low-stakes these edits are. The durable copy is removed too
// (rather than left to its own TTL) so a cold instance elsewhere can't
// resurrect the pre-edit data in the meantime — the next getSearchIndex()
// call anywhere pays one DB rebuild and re-persists a fresh copy, same
// one-time cost as before this durable cache existed.
export async function invalidateSearchIndex() {
	cachedIndex = null;
	await getImageStorage().remove(PERSISTED_INDEX_DIR, PERSISTED_INDEX_FILENAME);
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

// Two independent queries rather than one media-with-credits-join like this
// used to be — a person surfaces as their own result now (see
// GlobalSearchResult's "person" variant) instead of just nudging a media
// item's own relevance, so there's no join left to do here. Only people
// credited on at least one DONE, non-deleted media are included — otherwise
// a search could surface someone whose only work here is still PENDING or
// deleted, a dead end with nothing to actually show for them.
async function fetchSearchEntriesFromDb(): Promise<SearchableEntry[]> {
	const [mediaRows, personRows] = await Promise.all([
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
	return [...mediaEntries, ...personEntries];
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

// Media-and-people fuzzy search across the whole collection, for the
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

	const fuse = await getSearchIndex();
	const matches = fuse.search(trimmed);

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

	return matches.slice(0, SEARCH_LIMIT).map(
		({ item }): GlobalSearchResult =>
			item.kind === "media"
				? {
						kind: "media",
						id: item.id,
						title: item.title,
						type: item.type,
						releaseDate: item.releaseDate,
						posterSrc: toPosterSrc(item.id, item.posterPath),
					}
				: {
						kind: "person",
						id: item.id,
						name: item.title,
						photoSrc: toPersonPhotoSrc(item.id, item.photoPath),
						mainRole: item.mainRole,
						creditCount: item.creditCount,
					},
	);
}
