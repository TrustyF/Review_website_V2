import { type } from "arktype";

const MangaDexTagSchema = type({
	id: "string",
	attributes: {
		name: { "[string]": "string" },
		group: "string",
	},
});

const MangaDexRelationshipSchema = type({
	id: "string",
	type: "string",
	"attributes?": {
		"name?": "string",
		"fileName?": "string",
	},
});

export const MangaDexMangaResponseSchema = type({
	result: "string",
	data: {
		id: "string",
		attributes: {
			title: { "[string]": "string" },
			altTitles: type({ "[string]": "string" }).array(),
			description: { "[string]": "string" },
			status: "string",
			year: "number | null",
			originalLanguage: "string | null",
			lastVolume: "string | null",
			lastChapter: "string | null",
			tags: MangaDexTagSchema.array(),
		},
		relationships: MangaDexRelationshipSchema.array(),
	},
});

export type MangaDexMangaResponse = typeof MangaDexMangaResponseSchema.infer;
export type MangaDexManga = MangaDexMangaResponse["data"];

const MangaDexStatisticsEntrySchema = type({
	rating: {
		"average?": "number | null",
		"bayesian?": "number | null",
	},
});

export const MangaDexStatisticsResponseSchema = type({
	result: "string",
	statistics: { "[string]": MangaDexStatisticsEntrySchema },
});

export type MangaDexStatisticsEntry = typeof MangaDexStatisticsEntrySchema.infer;

// Lighter than MangaDexMangaResponseSchema — /manga (title search) returns a
// list, and search results only need enough to render a picker (title,
// year, cover), not the full detail payload a single /manga/{id} fetch has.
const MangaDexMangaSearchResultSchema = type({
	id: "string",
	attributes: {
		title: { "[string]": "string" },
		altTitles: type({ "[string]": "string" }).array(),
		year: "number | null",
	},
	relationships: MangaDexRelationshipSchema.array(),
});

export type MangaDexMangaSearchResult = typeof MangaDexMangaSearchResultSchema.infer;

export const MangaDexMangaSearchResponseSchema = type({
	result: "string",
	data: MangaDexMangaSearchResultSchema.array(),
});

const MangaDexCoverSchema = type({
	attributes: {
		fileName: "string",
		volume: "string | null",
	},
});

export const MangaDexCoversResponseSchema = type({
	result: "string",
	data: MangaDexCoverSchema.array(),
});

export type MangaDexCover = typeof MangaDexCoverSchema.infer;
