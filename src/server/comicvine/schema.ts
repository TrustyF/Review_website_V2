import { type } from "arktype";

// ComicVine's image object always carries every named size for a volume's
// cover — no per-field omission the way TMDB/IGDB sometimes leave a field
// out entirely.
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

// A volume's "people" list is flat — ComicVine only breaks credits down by
// role (writer, artist, ...) at the issue level, not the volume level, so
// there's no role field to read here.
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
	// Only present on the single-volume detail fetch, not the field_list-
	// limited search results — those don't need it, since it's only read
	// during actual ingest (add/update), never for a search picker.
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

// Used as this app's stand-in for "alternate posters": ComicVine has no
// alternate-cover-art concept at the volume level (unlike TMDB/MangaDex),
// but each issue within a volume has its own cover — issue 1's is usually
// the same image the volume itself reports, so browsing issues doubles as
// browsing that volume's available covers.
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
