"use server";
import Fuse from "fuse.js";
import { dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import { toPosterSrc } from "@/server/resolvers/poster-resolver";

export type GlobalSearchResult = {
	id: number;
	title: string;
	type: MediaType;
	posterSrc: string;
	releaseDate: Date | null;
};

const SEARCH_LIMIT = 8;

// Same typo tolerance as everywhere else fuzzy search happens in this app
// (list-actions.ts, the old per-page search) — 0.35 survives a couple of
// wrong/missing letters without turning every query into a firehose of
// unrelated results.
const FUSE_OPTIONS = {
	keys: [
		{ name: "title", weight: 0.6 },
		{ name: "alternateTitle", weight: 0.2 },
		{ name: "directors", weight: 0.1 },
		{ name: "studios", weight: 0.1 },
	],
	threshold: 0.35,
	ignoreLocation: true,
};

type SearchableMedia = {
	id: number;
	title: string;
	alternateTitle: string | null;
	type: MediaType;
	posterPath: string | null;
	releaseDate: Date | null;
	directors: string[];
	studios: string[];
};

// Module-scope, so it's shared across every debounced keystroke of the same
// typing session (and every visitor, while this server instance stays warm)
// instead of a fresh ~150-200ms DB round trip (the whole DONE-enriched
// collection, credits join included) plus a Fuse index rebuild on every one
// of them — that per-keystroke cost was the actual "slow, unresponsive"
// search bar complaint this was added for. On Vercel Fluid, module-scope
// memory is per-instance, and instances churn far more often than a human
// typing session lasts — a short TTL was mostly just forcing a rebuild (DB
// fetch + Fuse indexing, the CPU-heavy part) on close to every cold
// instance's first search, which is pure Active CPU cost for no freshness
// anyone asked for. This collection only changes via admin edits and ingest
// runs — both rare — so the TTL here is just a safety net; the actions that
// actually change what search should show (saveMediaDetails,
// setMediaDeleted, hardDeleteMedia, createManualMedia) call
// invalidateSearchIndex() directly for immediate freshness on the instance
// that served the edit. Ingest scripts run as a separate process, so they
// can't reach this module-scope cache either way — the TTL is what bounds
// staleness for those.
let cachedIndex: { fuse: Fuse<SearchableMedia>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60_000;

// Called by the admin actions that change title/overview/isDeleted/DONE
// status — the fields this index is actually built from. Only resets this
// instance's cache (module-scope, per-instance on Fluid), so other warm
// instances still converge via CACHE_TTL_MS rather than instantly; that's
// an acceptable gap for how rarely and low-stakes these edits are.
export async function invalidateSearchIndex() {
	cachedIndex = null;
	logSearchIndexEvent({ invalidated: true });
}

// CPU time (not wall clock) is what Vercel's Fluid "Active CPU" metric
// bills, so process.cpuUsage() deltas are the closest thing to profiling
// that cost directly from inside the app. Grep Vercel logs for
// "[search-index]" to see rebuild frequency (cacheHit:false lines) and cost
// (cpuMs) — e.g. before/after changing CACHE_TTL_MS.
function logSearchIndexEvent(event: Record<string, unknown>) {
	console.log("[search-index]", JSON.stringify(event));
}

async function getSearchIndex(): Promise<Fuse<SearchableMedia>> {
	if (cachedIndex && cachedIndex.expiresAt > Date.now()) {
		logSearchIndexEvent({ cacheHit: true });
		return cachedIndex.fuse;
	}

	const cpuBefore = process.cpuUsage();
	const startedAt = performance.now();

	const candidates = await dbPublic.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.DONE },
		select: {
			id: true,
			title: true,
			alternateTitle: true,
			type: true,
			posterPath: true,
			releaseDate: true,
			// Director/Studio only — enough for relevance, without pulling
			// every crew job for every item in the collection.
			credits: {
				where: { role: { name: { in: ["Director", "Studio"] } } },
				select: {
					person: { select: { name: true } },
					company: { select: { name: true } },
				},
			},
		},
		orderBy: { id: "asc" },
	});
	const dbDoneAt = performance.now();

	const searchable: SearchableMedia[] = candidates.map(({ credits, ...m }) => ({
		...m,
		directors: credits
			.map((c) => c.person?.name)
			.filter((name): name is string => name != null),
		studios: credits
			.map((c) => c.company?.name)
			.filter((name): name is string => name != null),
	}));

	const fuse = new Fuse(searchable, FUSE_OPTIONS);
	const indexDoneAt = performance.now();

	const cpu = process.cpuUsage(cpuBefore);
	logSearchIndexEvent({
		cacheHit: false,
		itemCount: searchable.length,
		dbMs: Math.round(dbDoneAt - startedAt),
		indexMs: Math.round(indexDoneAt - dbDoneAt),
		totalMs: Math.round(indexDoneAt - startedAt),
		cpuMs: Math.round((cpu.user + cpu.system) / 1000),
	});

	cachedIndex = { fuse, expiresAt: Date.now() + CACHE_TTL_MS };
	return fuse;
}

// Media-agnostic fuzzy search across the whole collection, for the navbar's
// jump-to-anything search — unlike MediaFilterGrid's old per-page search,
// this isn't scoped to one type or one already-loaded list. A quick
// "jump to a title" tool doesn't need overview-text matches the way the old
// per-page search did, so that field isn't fetched here at all — keeps the
// per-keystroke payload lighter.
export async function searchAllMedia(
	query: string,
): Promise<GlobalSearchResult[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const fuse = await getSearchIndex();

	return fuse
		.search(trimmed)
		.slice(0, SEARCH_LIMIT)
		.map(({ item: m }) => ({
			id: m.id,
			title: m.title,
			type: m.type,
			releaseDate: m.releaseDate,
			posterSrc: toPosterSrc(m.id, m.posterPath),
		}));
}
