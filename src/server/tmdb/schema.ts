import { type } from "arktype";

const zeroToNull = type("number").pipe((n) => (n === 0 ? null : n));

export const TmdbMovieResponseSchema = type({
	id: "number",
	title: "string",
	adult: "boolean",
	overview: "string | null",
	status: "string",
	release_date: "string | null",
	poster_path: "string",
	backdrop_path: "string | null",
	runtime: zeroToNull,
	budget: zeroToNull,
	revenue: zeroToNull,
	tagline: "string | null",
	imdb_id: "string | null",
	original_language: "string | null",
	vote_average: "number | null",
	popularity: "number | null",
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
			profile_path: "string | null",
		}).array(),
		// profile_path requested here too so crew gets a stored photoPath like cast; which get
		// downloaded is a separate read-time decision (person-photo-eligibility.ts).
		crew: type({
			id: "number",
			name: "string",
			job: "string",
			department: "string",
			profile_path: "string | null",
		}).array(),
	},
});

export type TmdbMovieResponse = typeof TmdbMovieResponseSchema.infer;

export const TmdbTvResponseSchema = type({
	id: "number",
	name: "string",
	adult: "boolean",
	overview: "string | null",
	status: "string",
	first_air_date: "string | null",
	poster_path: "string | null",
	backdrop_path: "string | null",
	number_of_episodes: "number | null",
	number_of_seasons: "number | null",
	networks: type({ id: "number", name: "string" }).array(),
	original_language: "string | null",
	vote_average: "number | null",
	popularity: "number | null",
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
	// A distinct top-level field, not a crew job — backs a TV show's "by ..." byline (tv-show-credits.ts).
	created_by: type({
		id: "number",
		name: "string",
		profile_path: "string | null",
	}).array(),
	// aggregate_credits, not credits — TMDB's plain `credits` only reflects the current/last-known
	// season's cast (e.g. drops Steve Carell from The Office's final season), while aggregate_credits
	// merges cast/crew across the whole run. See tv-show-credits.ts for how this is flattened.
	aggregate_credits: {
		// order is deliberately not read — aggregate_credits' order doesn't reflect billing prominence
		// (e.g. BoJack's Will Arnett, 76 episodes, comes back at order 67). Ranked by total_episode_count instead.
		cast: type({
			id: "number",
			name: "string",
			profile_path: "string | null",
			total_episode_count: "number",
			roles: type({
				character: "string",
			}).array(),
		}).array(),
		crew: type({
			id: "number",
			name: "string",
			department: "string",
			profile_path: "string | null",
			jobs: type({
				job: "string",
			}).array(),
		}).array(),
	},
});

export type TmdbTvResponse = typeof TmdbTvResponseSchema.infer;

// /person/{id} — used by backfill-person-photos.ts; minimal (id + profile_path) since that's all it needs.
export const TmdbPersonResponseSchema = type({
	id: "number",
	profile_path: "string | null",
});

export type TmdbPerson = typeof TmdbPersonResponseSchema.infer;

// /search/movie and /search/tv return a lightweight {results: [...]} shape, much smaller than the full detail objects.
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
	backdrops: type({
		file_path: "string",
		width: "number",
		height: "number",
		vote_average: "number",
		iso_639_1: "string | null",
	}).array(),
});

export type TmdbImagesResponse = typeof TmdbImagesResponseSchema.infer;
