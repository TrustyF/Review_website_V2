import { type } from "arktype";

// IGDB's /games endpoint returns a bare JSON array (no {data: ...} wrapper),
// one entry per matched id.
export const IgdbGameSchema = type({
	id: "number",
	name: "string",
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
