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

const TMDB_BASE = "https://api.themoviedb.org/3";

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
	const res = await fetch(
		`${TMDB_BASE}/${ConvertTypeToString(media_type)}/${id}?&language=en-US&append_to_response=content_ratings,credits,external_ids`,
		{
			headers: new Headers({
				Accept: "application/json",
				Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
			}),
		},
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
	const res = await fetch(
		`${TMDB_BASE}/search/${ConvertTypeToString(media_type)}?query=${encodeURIComponent(name)}&include_adult=true&page=${page}`,
		{
			headers: new Headers({
				Accept: "application/json",
				Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
			}),
		},
	);

	if (!res.ok)
		throw new Error(`TMDB fetch failed for movie ${name}: ${res.statusText}`);

	const json = await res.json();
	return parseOrThrow(TmdbMovieSearchResponseSchema, json).results;
}

export async function fetchTvShowById(id: string): Promise<TmdbTvResponse> {
	const res = await fetch(
		`${TMDB_BASE}/tv/${id}?&language=en-US&append_to_response=content_ratings,credits,external_ids`,
		{
			headers: new Headers({
				Accept: "application/json",
				Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
			}),
		},
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
	const res = await fetch(
		`${TMDB_BASE}/${ConvertTypeToString(media_type)}/${id}/images?include_image_language=en,null`,
		{
			headers: new Headers({
				Accept: "application/json",
				Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
			}),
		},
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

export async function fetchTvShowByName(
	name: string,
	page: number,
): Promise<TmdbTvSearchResult[]> {
	const res = await fetch(
		`${TMDB_BASE}/search/tv?query=${encodeURIComponent(name)}&include_adult=true&page=${page}`,
		{
			headers: new Headers({
				Accept: "application/json",
				Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
			}),
		},
	);

	if (!res.ok)
		throw new Error(`TMDB fetch failed for tv show ${name}: ${res.statusText}`);

	const json = await res.json();
	return parseOrThrow(TmdbTvSearchResponseSchema, json).results;
}
