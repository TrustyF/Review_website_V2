import { type } from "arktype";

// Google Books never guarantees any volumeInfo field is present — a
// self-published or sparsely-cataloged entry can come back with just a
// title, so every field below except id/title is optional.
const GoogleBooksImageLinksSchema = type({
	"smallThumbnail?": "string | null",
	"thumbnail?": "string | null",
});

const GoogleBooksIndustryIdentifierSchema = type({
	type: "string",
	identifier: "string",
});

const GoogleBooksVolumeInfoSchema = type({
	title: "string",
	"authors?": "string[]",
	"publisher?": "string | null",
	"publishedDate?": "string | null",
	"description?": "string | null",
	"pageCount?": "number | null",
	"categories?": "string[]",
	"maturityRating?": "string | null",
	"imageLinks?": GoogleBooksImageLinksSchema,
	"industryIdentifiers?": GoogleBooksIndustryIdentifierSchema.array(),
	"infoLink?": "string | null",
});

export const GoogleBooksVolumeSchema = type({
	id: "string",
	volumeInfo: GoogleBooksVolumeInfoSchema,
});

export type GoogleBooksVolume = typeof GoogleBooksVolumeSchema.infer;

export const GoogleBooksSearchResponseSchema = type({
	"totalItems?": "number",
	// Google Books omits `items` entirely (rather than returning `[]`) when a
	// search matches nothing.
	"items?": GoogleBooksVolumeSchema.array(),
});
