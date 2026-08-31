import { type } from "arktype";

// ComicVine's image object always carries every named size, unlike TMDB/IGDB which may omit fields.
const ComicVineImageSchema = type({
	"icon_url?": "string | null",
	"medium_url?": "string | null",
	"small_url?": "string | null",
	"super_url?": "string | null",
	"screen_url?": "string | null",
	"screen_large_url?": "string | null",
	"thumb_url?": "string | null",
	"tiny_url?": "string | null",
	"original_url?": "string | null",
});

// Flat — ComicVine only breaks credits down by role at the issue level, not the volume level.
const ComicVinePersonRefSchema = type({
	id: "number",
	name: "string",
});

const ComicVinePublisherSchema = type({
	id: "number",
	name: "string",
});

export const ComicVineVolumeSchema = type({
	id: "number",
	name: "string",
	"deck?": "string | null",
	"description?": "string | null",
	"start_year?": "string | null",
	"count_of_issues?": "number | null",
	"image?": ComicVineImageSchema,
	"publisher?": ComicVinePublisherSchema,
	"people?": ComicVinePersonRefSchema.array(),
	// Only present on the single-volume detail fetch, not the field_list-limited search results.
	"site_detail_url?": "string | null",
});

export type ComicVineVolume = typeof ComicVineVolumeSchema.infer;

export const ComicVineVolumeResponseSchema = type({
	status_code: "number",
	error: "string",
	results: ComicVineVolumeSchema,
});

export const ComicVineVolumeSearchResponseSchema = type({
	status_code: "number",
	error: "string",
	results: ComicVineVolumeSchema.array(),
});

// Stand-in for "alternate posters": ComicVine has no volume-level cover-art concept, so issue covers are used instead.
export const ComicVineIssueSchema = type({
	id: "number",
	"name?": "string | null",
	"issue_number?": "string | null",
	"image?": ComicVineImageSchema,
});

export type ComicVineIssue = typeof ComicVineIssueSchema.infer;

export const ComicVineIssueSearchResponseSchema = type({
	status_code: "number",
	error: "string",
	results: ComicVineIssueSchema.array(),
});
