import { type } from "arktype";

// IGDB's /games endpoint returns a bare JSON array (no {data: ...} wrapper).
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
	// Landscape promo art used as the banner image; width/height are optional since IGDB sometimes
	// returns an artwork still processing on its CDN (filtered out by pickBestArtwork, not rejected here).
	"artworks?": type({
		image_id: "string",
		"width?": "number",
		"height?": "number",
	}).array(),
});

export type IgdbGame = typeof IgdbGameSchema.infer;

export const IgdbGamesResponseSchema = IgdbGameSchema.array();

// Lighter than IgdbGameSchema — the search query only needs enough to render a picker.
const IgdbGameSearchResultSchema = type({
	id: "number",
	name: "string",
	"first_release_date?": "number | null",
	"cover?": { image_id: "string" },
});

export type IgdbGameSearchResult = typeof IgdbGameSearchResultSchema.infer;

export const IgdbGameSearchResponseSchema = IgdbGameSearchResultSchema.array();

// /covers is 1:1 per game; combined with game_localizations below since neither alone is complete.
const IgdbCoverSchema = type({
	id: "number",
	image_id: "string",
});

export const IgdbCoverListSchema = IgdbCoverSchema.array();

// Most localizations have no art of their own, so cover is optional (the caller filters cover != null).
const IgdbGameLocalizationSchema = type({
	id: "number",
	"cover?": { image_id: "string" },
	"region?": { name: "string" },
});

export const IgdbGameLocalizationListSchema =
	IgdbGameLocalizationSchema.array();
