import { type } from "arktype";

// IGDB's /games endpoint returns a bare JSON array (no {data: ...} wrapper),
// one entry per matched id.
export const IgdbGameSchema = type({
	id: "number",
	name: "string",
	url: "string",
	"summary?": "string | null",
	"first_release_date?": "number | null",
	"total_rating?": "number | null",
	"status?": "number | null",
	"genres?": type({
		id: "number",
		name: "string",
	}).array(),
	"involved_companies?": type({
		company: { id: "number", name: "string" },
		developer: "boolean",
		publisher: "boolean",
	}).array(),
	"cover?": { image_id: "string" },
	"platforms?": type({
		id: "number",
		name: "string",
	}).array(),
	// Promotional artwork — wide/landscape, unlike cover — used as this
	// app's banner image for games. Not every game has any. width/height are
	// only used to pick the closest-to-16:9 option (see pickBestArtwork) —
	// IGDB has no per-image relevance/vote signal the way TMDB does.
	"artworks?": type({ image_id: "string", width: "number", height: "number" }).array(),
});

export type IgdbGame = typeof IgdbGameSchema.infer;

export const IgdbGamesResponseSchema = IgdbGameSchema.array();

// Lighter than IgdbGameSchema — used for the "search" query, which only
// needs enough to render a picker (name, year, cover), not the full detail
// fields a where-by-id fetch pulls.
const IgdbGameSearchResultSchema = type({
	id: "number",
	name: "string",
	"first_release_date?": "number | null",
	"cover?": { image_id: "string" },
});

export type IgdbGameSearchResult = typeof IgdbGameSearchResultSchema.infer;

export const IgdbGameSearchResponseSchema = IgdbGameSearchResultSchema.array();

// /covers is a 1:1 relation to a game (one default cover) — used alongside
// game_localizations below to build the full set of cover options a game
// actually has, since neither endpoint alone has the complete picture.
const IgdbCoverSchema = type({
	id: "number",
	image_id: "string",
});

export const IgdbCoverListSchema = IgdbCoverSchema.array();

// Region-specific release info — most entries are just a localized name
// with no art of their own, so cover is optional and filtered for by the
// caller (cover != null in the query itself already does this, but the
// type still has to allow for a localization with no cover).
const IgdbGameLocalizationSchema = type({
	id: "number",
	"cover?": { image_id: "string" },
	"region?": { name: "string" },
});

export const IgdbGameLocalizationListSchema =
	IgdbGameLocalizationSchema.array();
