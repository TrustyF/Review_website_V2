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
		// profile_path requested here too — every crew credit gets a stored
		// photoPath the same as cast does (see Person.photoPath's own comment);
		// which of those actually get downloaded is a separate, read-time
		// decision (see person-photo-eligibility.ts), not something that
		// affects what's parsed here.
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
	// The show's actual creator(s) — a distinct top-level field, not a crew
	// job. See tv-show-credits.ts for why this (not a "Director" credit) is
	// what backs a TV show's "by ..." byline.
	created_by: type({
		id: "number",
		name: "string",
		profile_path: "string | null",
	}).array(),
	// aggregate_credits, not credits — TMDB's plain `credits` sub-resource for
	// a TV show only reflects the *current*/last-known season's billed cast
	// (e.g. it drops an actor who left the show before its final season, like
	// Steve Carell on The Office), not the show's full run. aggregate_credits
	// merges cast/crew across every season/episode instead, which is what a
	// "cast" list on a show's page should actually mean. See
	// tv-show-credits.ts for how this gets flattened back into the same
	// {id, name, character/job, ...} shape TmdbMovieResponseSchema's `credits`
	// already uses, since a person can carry more than one role/job across a
	// show's run (roles/jobs arrays) where a movie credit never does.
	aggregate_credits: {
		// order is deliberately not read here — unlike credits.cast (movies,
		// and the old per-season TV credits this replaced), aggregate_credits'
		// own order doesn't reflect billing prominence at all (e.g. on BoJack
		// Horseman, Will Arnett — the title character, 76 episodes — comes back
		// at order 67, behind one-off guests with single-digit orders). See
		// tv-show-credits.ts for what actually ranks cast instead
		// (total_episode_count).
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

// /person/{id} — only used by backfill-person-photos.ts to fetch a single
// missing photoPath directly, far cheaper than re-running a whole movie/show
// enrichment just for this one field. Deliberately minimal (id +
// profile_path only) rather than the full person-detail response, since
// that's all that script needs.
export const TmdbPersonResponseSchema = type({
	id: "number",
	profile_path: "string | null",
});

export type TmdbPerson = typeof TmdbPersonResponseSchema.infer;

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
	backdrops: type({
		file_path: "string",
		width: "number",
		height: "number",
		vote_average: "number",
		iso_639_1: "string | null",
	}).array(),
});

export type TmdbImagesResponse = typeof TmdbImagesResponseSchema.infer;
