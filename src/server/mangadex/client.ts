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

const MANGADEX_BASE = "https://api.mangadex.org";

// MangaDex's read API is public — no API key/auth needed for these endpoints.
export async function fetchMangaDexById(
	id: string,
): Promise<MangaDexMangaResponse> {
	const res = await fetch(
		`${MANGADEX_BASE}/manga/${id}?includes[]=author&includes[]=artist&includes[]=cover_art`,
		{ headers: new Headers({ Accept: "application/json" }) },
	);

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`MangaDex fetch failed for manga ${id} : ${errorText}`);
	}

	const json = await res.json();
	return parseOrThrow(MangaDexMangaResponseSchema, json);
}

// Ratings live on a separate endpoint from the manga entity itself. Returns
// null rather than throwing when a manga has no statistics yet (new/obscure
// entries) so a missing rating never blocks enrichment of the rest.
export async function fetchMangaDexStatistics(
	id: string,
): Promise<MangaDexStatisticsEntry | null> {
	const res = await fetch(`${MANGADEX_BASE}/statistics/manga/${id}`, {
		headers: new Headers({ Accept: "application/json" }),
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(
			`MangaDex statistics fetch failed for manga ${id} : ${errorText}`,
		);
	}

	const json = await res.json();
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

	const res = await fetch(`${MANGADEX_BASE}/manga?${params}`, {
		headers: new Headers({ Accept: "application/json" }),
	});

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

	const res = await fetch(`${MANGADEX_BASE}/cover?${params}`, {
		headers: new Headers({ Accept: "application/json" }),
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(
			`MangaDex covers fetch failed for manga ${mangaId} : ${errorText}`,
		);
	}

	const json = await res.json();
	return parseOrThrow(MangaDexCoversResponseSchema, json).data;
}
