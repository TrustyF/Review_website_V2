import {
	TmdbImagesResponse,
	TmdbImagesResponseSchema,
	TmdbMovieResponse,
	TmdbMovieResponseSchema,
	TmdbMovieSearchResponseSchema,
	TmdbMovieSearchResult,
	TmdbTvResponse,
	TmdbTvResponseSchema,
	TmdbTvSearchResponseSchema,
	TmdbTvSearchResult,
} from "./schema";
import { MediaType } from "@prisma/client";
import { parseOrThrow } from "@/lib/arktype/parse-or-throw";
import { createRateLimiter } from "@/server/lib/rate-limited-fetch";

const TMDB_BASE = "https://api.themoviedb.org/3";

// No hard documented per-second limit — light defensive spacing so a batch
// run (enrich-db) can't burst unbounded, without slowing normal enrichment.
const limiter = createRateLimiter({ minIntervalMs: 100 });

// Every TMDB request shares the same auth header and the same limiter — one
// place for both instead of repeating them at each call site below.
function tmdbFetch(url: string): Promise<Response> {
	return limiter.fetch(url, {
		headers: new Headers({
			Accept: "application/json",
			Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
		}),
	});
}

function ConvertTypeToString(type: MediaType): string {
	const TMDB_TYPE_MAP: Partial<Record<MediaType, string>> = {
		TVSHOW: "tv",
		MOVIE: "movie",
		SHORT: "movie",
	};
	const segment = TMDB_TYPE_MAP[type];
	if (!segment) throw new Error(`No TMDB endpoint for media type ${type}`);
	return segment;
}

export async function fetchTmdbById(
	id: string,
	media_type: MediaType,
): Promise<TmdbMovieResponse> {
	const res = await tmdbFetch(
		`${TMDB_BASE}/${ConvertTypeToString(media_type)}/${id}?&language=en-US&append_to_response=content_ratings,credits,external_ids`,
	);

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`TMDB fetch failed for ${media_type} ${id} : ${errorText}`);
	}

	const json = await res.json();
	return parseOrThrow(TmdbMovieResponseSchema, json);
}
export async function fetchTmdbByName(
	name: string,
	media_type: MediaType,
	page: number,
): Promise<TmdbMovieSearchResult[]> {
	const res = await tmdbFetch(
		`${TMDB_BASE}/search/${ConvertTypeToString(media_type)}?query=${encodeURIComponent(name)}&include_adult=true&page=${page}`,
	);

	if (!res.ok)
		throw new Error(`TMDB fetch failed for movie ${name}: ${res.statusText}`);

	const json = await res.json();
	return parseOrThrow(TmdbMovieSearchResponseSchema, json).results;
}

export async function fetchTvShowById(id: string): Promise<TmdbTvResponse> {
	const res = await tmdbFetch(
		`${TMDB_BASE}/tv/${id}?&language=en-US&append_to_response=content_ratings,credits,external_ids`,
	);

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`TMDB fetch failed for tv show ${id} : ${errorText}`);
	}

	const json = await res.json();
	return parseOrThrow(TmdbTvResponseSchema, json);
}

// include_image_language=en,null keeps posters that are either English or
// textless — otherwise the response is dominated by posters in whatever
// language happens to have the most uploads (usually not English).
export async function fetchTmdbImages(
	id: string,
	media_type: MediaType,
): Promise<TmdbImagesResponse> {
	const res = await tmdbFetch(
		`${TMDB_BASE}/${ConvertTypeToString(media_type)}/${id}/images?include_image_language=en,null`,
	);

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(
			`TMDB images fetch failed for ${media_type} ${id} : ${errorText}`,
		);
	}

	const json = await res.json();
	return parseOrThrow(TmdbImagesResponseSchema, json);
}

type TmdbBackdrop = TmdbImagesResponse["backdrops"][number];

// TMDB doesn't flag whether a backdrop is a plain film still or has
// title/logo art baked in — iso_639_1: null is the closest proxy (a
// language-tagged backdrop is conventionally one with localized text on
// it), so a textless one is preferred whenever one exists. Within whichever
// pool applies, highest community vote_average wins.
export function pickBestBackdrop(backdrops: TmdbBackdrop[]): string | null {
	if (backdrops.length === 0) return null;
	const textless = backdrops.filter((b) => b.iso_639_1 === null);
	const pool = textless.length > 0 ? textless : backdrops;
	return pool.reduce((best, b) =>
		b.vote_average > best.vote_average ? b : best,
	).file_path;
}

export async function fetchTvShowByName(
	name: string,
	page: number,
): Promise<TmdbTvSearchResult[]> {
	const res = await tmdbFetch(
		`${TMDB_BASE}/search/tv?query=${encodeURIComponent(name)}&include_adult=true&page=${page}`,
	);

	if (!res.ok)
		throw new Error(`TMDB fetch failed for tv show ${name}: ${res.statusText}`);

	const json = await res.json();
	return parseOrThrow(TmdbTvSearchResponseSchema, json).results;
}
