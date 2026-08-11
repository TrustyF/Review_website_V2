import { MediaType } from "@prisma/client";
import { MediaRecord } from "@/components/media/types";

export type MediaFilterState = {
	// Empty = no genre filter (show everything). Non-empty = show only media
	// that has at least one of these genres — a whitelist, not a blacklist:
	// checking a box narrows the grid down to it, rather than hiding it.
	includedGenres: Set<string>;
	minRating: number | null;
	maxRating: number | null;
	minRuntime: number | null;
	maxRuntime: number | null;
	// Same whitelist idea as includedGenres, over Review.difficulty's 0/1/2
	// domain (see DIFFICULTY_LEVELS) rather than genre strings.
	includedDifficulties: Set<number>;
};

export const EMPTY_MEDIA_FILTER: MediaFilterState = {
	includedGenres: new Set(),
	minRating: null,
	maxRating: null,
	minRuntime: null,
	maxRuntime: null,
	includedDifficulties: new Set(),
};

// Review.difficulty's own 0/1/2 domain (see media-editor-modal.tsx's number
// input) — a fixed, always-the-same-three-options list, unlike genres, so
// there's no need for a collectDifficulties() derived from the media the
// way collectGenres() is.
export const DIFFICULTY_LEVELS: { value: number; label: string }[] = [
	{ value: 0, label: "Easy" },
	{ value: 1, label: "Medium" },
	{ value: 2, label: "Hard" },
];

// How long a grid waits after the last filter tweak (a slider tick, a
// checkbox click) before actually re-filtering its list — same idea as
// nav-search.tsx's own search debounce, just shorter: dragging a slider can
// fire onChange many times a second, and re-running matchesMediaFilter over
// the whole list on every one of those ticks is wasted work the eye can't
// even register between frames.
export const FILTER_DEBOUNCE_MS = 150;

export function isFilterActive(filter: MediaFilterState): boolean {
	return (
		filter.includedGenres.size > 0 ||
		filter.minRating != null ||
		filter.maxRating != null ||
		filter.minRuntime != null ||
		filter.maxRuntime != null ||
		filter.includedDifficulties.size > 0
	);
}

// Only Movie/Short carry a runtime (the sub-table the two share) — everything
// else has nothing to compare against a runtime bound.
export function getRuntimeMinutes(media: MediaRecord): number | null {
	if (media.type === "MOVIE" || media.type === "SHORT")
		return media.movie.runtime;
	return null;
}

// A rating/runtime bound excludes media with no value for that field, not
// just media outside the range — there's nothing for "only show 7+" to
// compare an unrated item against, so it can't pass either way.
export function matchesMediaFilter(
	media: MediaRecord,
	filter: MediaFilterState,
): boolean {
	if (
		filter.includedGenres.size > 0 &&
		!media.genres.some((genre) => filter.includedGenres.has(genre))
	) {
		return false;
	}

	if (filter.minRating != null || filter.maxRating != null) {
		const rating = media.review?.rating ?? null;
		if (rating == null) return false;
		if (filter.minRating != null && rating < filter.minRating) return false;
		if (filter.maxRating != null && rating > filter.maxRating) return false;
	}

	if (filter.minRuntime != null || filter.maxRuntime != null) {
		const runtime = getRuntimeMinutes(media);
		if (runtime == null) return false;
		if (filter.minRuntime != null && runtime < filter.minRuntime) return false;
		if (filter.maxRuntime != null && runtime > filter.maxRuntime) return false;
	}

	if (filter.includedDifficulties.size > 0) {
		// Unset counts as Easy (0), not "excluded" — same equivalence
		// MediaPoster's own notch already draws (see its comment: "0/null
		// means 'not rated for difficulty'", both rendering as no notch at
		// all), so a media item nobody's flagged Medium/Hard reads as Easy
		// here too rather than disappearing from every difficulty filter.
		const difficulty = media.review?.difficulty ?? 0;
		if (!filter.includedDifficulties.has(difficulty)) return false;
	}

	return true;
}

// Sorted, deduped genre list for a set of media — the popover's checkbox
// options. Derived from whatever's passed in (usually the *un*filtered list,
// so unchecking a genre doesn't make its own checkbox disappear).
export function collectGenres(media: MediaRecord[]): string[] {
	const genres = new Set<string>();
	for (const item of media) {
		for (const genre of item.genres) genres.add(genre);
	}
	return [...genres].sort((a, b) => a.localeCompare(b));
}

export type FilterField = "genre" | "rating" | "runtime" | "difficulty";

// The one place that says which filter dimensions make sense for which
// media type — e.g. a game has no runtime to filter by, so MediaFilterPopover
// shouldn't offer a Runtime slider on a page that's showing only games.
// Extend this, not a scattered set of per-type `if`s elsewhere, whenever a
// new filterable field (or a new media type) needs this decision made.
// difficulty lives on Review, same as rating — every type gets it.
const FILTERABLE_FIELDS_BY_TYPE: Record<MediaType, ReadonlySet<FilterField>> = {
	[MediaType.MOVIE]: new Set(["genre", "rating", "runtime", "difficulty"]),
	[MediaType.SHORT]: new Set(["genre", "rating", "runtime", "difficulty"]),
	[MediaType.TVSHOW]: new Set(["genre", "rating", "difficulty"]),
	[MediaType.MANGA]: new Set(["genre", "rating", "difficulty"]),
	[MediaType.COMIC]: new Set(["genre", "rating", "difficulty"]),
	[MediaType.GAME]: new Set(["genre", "rating", "difficulty"]),
	[MediaType.BOOK]: new Set(["genre", "rating", "difficulty"]),
};

// Union of filterable fields across whatever media types are actually
// present — a mixed-type grid (a credit page, a list) keeps a field visible
// as long as at least one item present could use it; matchesMediaFilter
// already excludes the items that can't (see its own comment on that).
export function availableFilterFields(media: MediaRecord[]): Set<FilterField> {
	const fields = new Set<FilterField>();
	for (const item of media) {
		for (const field of FILTERABLE_FIELDS_BY_TYPE[item.type]) fields.add(field);
	}
	return fields;
}
