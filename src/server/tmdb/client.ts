import { TmdbMovieResponse, TmdbMovieResponseSchema } from "./schema";
import { MediaType } from "@prisma/client";
import { parseOrThrow } from "@/lib/arktype/parse-or-throw";

const TMDB_BASE = "https://api.themoviedb.org/3";

const TMDB_TYPE_MAP: Partial<Record<MediaType, string>> = {
	TVSHOW: "tv",
	MOVIE: "movie",
	SHORT: "movie",
};

function toTmdbPathSegment(type: MediaType): string {
	const segment = TMDB_TYPE_MAP[type];
	if (!segment) throw new Error(`No TMDB endpoint for media type ${type}`);
	return segment;
}

export async function fetchTmdbById(
	id: string,
	media_type: MediaType,
): Promise<TmdbMovieResponse> {
	const res = await fetch(
		`${TMDB_BASE}/${toTmdbPathSegment(media_type)}/${id}?&language=en-US&append_to_response=content_ratings,credits,external_ids`,
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
): Promise<TmdbMovieResponse> {
	const res = await fetch(
		`${TMDB_BASE}/search/${toTmdbPathSegment(media_type)}?query=${name}&include_adult=true&page=${page}`,
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
	return parseOrThrow(TmdbMovieResponseSchema, json);
}
