import {
	MangaDexCover,
	MangaDexCoversResponseSchema,
	MangaDexMangaResponse,
	MangaDexMangaResponseSchema,
	MangaDexMangaSearchResponseSchema,
	MangaDexMangaSearchResult,
	MangaDexStatisticsEntry,
	MangaDexStatisticsResponseSchema,
} from "./schema";
import { parseOrThrow } from "@/lib/arktype/parse-or-throw";
import { createRateLimiter } from "@/server/lib/rate-limited-fetch";
import { cachedJson } from "@/server/lib/response-cache";

const MANGADEX_BASE = "https://api.mangadex.org";

// MangaDex documents a ~5 request/second per-IP limit. Also directly caps
// enrich-db.ts's per-item fetchMangaDexById + fetchMangaDexStatistics pair
// (issued together via Promise.all) — both share this one limiter, so real
// request rate stays capped regardless of how many items enrich concurrently.
const limiter = createRateLimiter({ minIntervalMs: 200 });

function mangaDexFetch(url: string, signal?: AbortSignal): Promise<Response> {
	return limiter.fetch(url, {
		headers: new Headers({ Accept: "application/json" }),
		...(signal ? { signal } : {}),
	});
}

// MangaDex publishes /ping specifically for reachability checks. No API key
// is involved for this source, so a non-ok response here only ever means
// the endpoint itself is down.
export async function isMangaDexReachable(): Promise<boolean> {
	try {
		const res = await mangaDexFetch(
			`${MANGADEX_BASE}/ping`,
			AbortSignal.timeout(5000),
		);
		return res.ok;
	} catch {
		return false;
	}
}

// MangaDex's read API is public — no API key/auth needed for these endpoints.
export async function fetchMangaDexById(
	id: string,
): Promise<MangaDexMangaResponse> {
	const json = await cachedJson("mangadex", `manga-${id}`, async () => {
		const res = await mangaDexFetch(
			`${MANGADEX_BASE}/manga/${id}?includes[]=author&includes[]=artist&includes[]=cover_art`,
		);

		if (!res.ok) {
			const errorText = await res.text();
			throw new Error(`MangaDex fetch failed for manga ${id} : ${errorText}`);
		}

		return res.json();
	});
	return parseOrThrow(MangaDexMangaResponseSchema, json);
}

// Ratings live on a separate endpoint from the manga entity itself. Returns
// null rather than throwing when a manga has no statistics yet (new/obscure
// entries) so a missing rating never blocks enrichment of the rest.
export async function fetchMangaDexStatistics(
	id: string,
): Promise<MangaDexStatisticsEntry | null> {
	const json = await cachedJson("mangadex", `statistics-${id}`, async () => {
		const res = await mangaDexFetch(`${MANGADEX_BASE}/statistics/manga/${id}`);

		if (!res.ok) {
			const errorText = await res.text();
			throw new Error(
				`MangaDex statistics fetch failed for manga ${id} : ${errorText}`,
			);
		}

		return res.json();
	});
	const parsed = parseOrThrow(MangaDexStatisticsResponseSchema, json);
	return parsed.statistics[id] ?? null;
}

export async function searchMangaDex(
	query: string,
): Promise<MangaDexMangaSearchResult[]> {
	const params = new URLSearchParams({
		title: query,
		limit: "20",
		"order[relevance]": "desc",
	});
	params.append("includes[]", "cover_art");

	const res = await mangaDexFetch(`${MANGADEX_BASE}/manga?${params}`);

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`MangaDex search failed for "${query}" : ${errorText}`);
	}

	const json = await res.json();
	return parseOrThrow(MangaDexMangaSearchResponseSchema, json).data;
}

// Unlike TMDB (one poster per movie/show plus alternates), MangaDex tracks a
// separate cover per volume/locale — a manga easily has 50+. All of them are
// legitimate "pick a cover" options, so nothing here filters by locale/volume.
export async function fetchMangaDexCovers(
	mangaId: string,
): Promise<MangaDexCover[]> {
	const params = new URLSearchParams({ limit: "100", "order[volume]": "asc" });
	params.append("manga[]", mangaId);

	const res = await mangaDexFetch(`${MANGADEX_BASE}/cover?${params}`);

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(
			`MangaDex covers fetch failed for manga ${mangaId} : ${errorText}`,
		);
	}

	const json = await res.json();
	return parseOrThrow(MangaDexCoversResponseSchema, json).data;
}
