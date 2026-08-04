import { type } from "arktype";

const zeroToNull = type("number").pipe((n) => (n === 0 ? null : n));

export const TmdbMovieResponseSchema = type({
	id: "number",
	title: "string",
	overview: "string | null",
	release_date: "string | null",
	poster_path: "string",
	runtime: "number",
	budget: zeroToNull,
	revenue: zeroToNull,
	tagline: "string | null",
	imdb_id: "string | null",
	original_language: "string | null",
	vote_average: "number | null",
	origin_country: "string[]",
	genres: type({
		id: "number",
		name: "string",
	}).array(),
	production_companies: type({
		id: "number",
		name: "string",
		logo_path: "string | null",
		origin_country: "string",
	}).array(),
	production_countries: type({
		iso_3166_1: "string",
		name: "string",
	}).array(),
	credits: {
		cast: type({
			id: "number",
			name: "string",
			character: "string",
			order: "number",
		}).array(),
		crew: type({
			id: "number",
			name: "string",
			job: "string",
			department: "string",
		}).array(),
	},
});

export type TmdbMovieResponse = typeof TmdbMovieResponseSchema.infer;

export const TmdbTvResponseSchema = type({
	id: "number",
	name: "string",
	overview: "string | null",
	first_air_date: "string | null",
	poster_path: "string | null",
	number_of_episodes: "number | null",
	number_of_seasons: "number | null",
	networks: type({ id: "number", name: "string" }).array(),
	original_language: "string | null",
	vote_average: "number | null",
	origin_country: "string[]",
	genres: type({
		id: "number",
		name: "string",
	}).array(),
	production_companies: type({
		id: "number",
		name: "string",
		logo_path: "string | null",
		origin_country: "string",
	}).array(),
	production_countries: type({
		iso_3166_1: "string",
		name: "string",
	}).array(),
	credits: {
		cast: type({
			id: "number",
			name: "string",
			character: "string",
			order: "number",
		}).array(),
		crew: type({
			id: "number",
			name: "string",
			job: "string",
			department: "string",
		}).array(),
	},
});

export type TmdbTvResponse = typeof TmdbTvResponseSchema.infer;

// /search/movie and /search/tv return a paginated {results: [...]} envelope
// of lightweight entries — a different (much smaller) shape than the full
// detail object TmdbMovieResponseSchema/TmdbTvResponseSchema validate.
const TmdbMovieSearchResultSchema = type({
	id: "number",
	title: "string",
	poster_path: "string | null",
	release_date: "string | null",
});

export type TmdbMovieSearchResult = typeof TmdbMovieSearchResultSchema.infer;

export const TmdbMovieSearchResponseSchema = type({
	results: TmdbMovieSearchResultSchema.array(),
});

const TmdbTvSearchResultSchema = type({
	id: "number",
	name: "string",
	poster_path: "string | null",
	first_air_date: "string | null",
});

export type TmdbTvSearchResult = typeof TmdbTvSearchResultSchema.infer;

export const TmdbTvSearchResponseSchema = type({
	results: TmdbTvSearchResultSchema.array(),
});

export const TmdbImagesResponseSchema = type({
	id: "number",
	posters: type({
		file_path: "string",
		width: "number",
		height: "number",
		vote_average: "number",
		iso_639_1: "string | null",
	}).array(),
});

export type TmdbImagesResponse = typeof TmdbImagesResponseSchema.infer;
