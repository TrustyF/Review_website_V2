import { MediaType } from "@prisma/client";
import { MediaRecord } from "@/components/media/types";

export type MediaFilterState = {
	// Empty = no filter. Non-empty = whitelist: show only media with at least one of these genres.
	includedGenres: Set<string>;
	minRating: number | null;
	maxRating: number | null;
	minRuntime: number | null;
	maxRuntime: number | null;
	// Same whitelist idea as includedGenres, over Review.difficulty's 0/1/2 domain.
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

// Fixed three-option list, unlike genres, so no collectDifficulties() derivation is needed.
export const DIFFICULTY_LEVELS: { value: number; label: string }[] = [
	{ value: 0, label: "Easy" },
	{ value: 1, label: "Medium" },
	{ value: 2, label: "Hard" },
];

// Debounce so a dragged slider (many onChange fires/sec) doesn't re-filter the whole list on every tick.
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

// Only Movie/Short carry a runtime; everything else has nothing to compare against a runtime bound.
export function getRuntimeMinutes(media: MediaRecord): number | null {
	if (media.type === "MOVIE" || media.type === "SHORT")
		return media.movie.runtime;
	return null;
}

// A rating/runtime bound excludes media with no value for that field too, not just media outside the range.
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
		// Unset counts as Easy (0), not "excluded", so unflagged items don't disappear from every difficulty filter.
		const difficulty = media.review?.difficulty ?? 0;
		if (!filter.includedDifficulties.has(difficulty)) return false;
	}

	return true;
}

// Sorted, deduped genre list for the popover's checkbox options. Usually derived from the unfiltered list so unchecking a genre doesn't hide its own checkbox.
export function collectGenres(media: MediaRecord[]): string[] {
	const genres = new Set<string>();
	for (const item of media) {
		for (const genre of item.genres) genres.add(genre);
	}
	return [...genres].sort((a, b) => a.localeCompare(b));
}

export type FilterField = "genre" | "rating" | "runtime" | "difficulty";

// The one place that says which filter dimensions apply to which media type; extend this, not scattered per-type ifs.
const FILTERABLE_FIELDS_BY_TYPE: Record<MediaType, ReadonlySet<FilterField>> = {
	[MediaType.MOVIE]: new Set(["genre", "rating", "runtime", "difficulty"]),
	[MediaType.SHORT]: new Set(["genre", "rating", "runtime", "difficulty"]),
	[MediaType.TVSHOW]: new Set(["genre", "rating", "difficulty"]),
	[MediaType.MANGA]: new Set(["genre", "rating", "difficulty"]),
	[MediaType.COMIC]: new Set(["genre", "rating", "difficulty"]),
	[MediaType.GAME]: new Set(["genre", "rating", "difficulty"]),
	[MediaType.BOOK]: new Set(["genre", "rating", "difficulty"]),
};

// Union of filterable fields across present media types; a mixed-type grid keeps a field visible if any item present could use it.
export function availableFilterFields(media: MediaRecord[]): Set<FilterField> {
	const fields = new Set<FilterField>();
	for (const item of media) {
		for (const field of FILTERABLE_FIELDS_BY_TYPE[item.type]) fields.add(field);
	}
	return fields;
}

// Reads filter state out of a catalog page's own URL, so it survives back/forward navigation and stays shareable/bookmarkable.
export function mediaFilterFromSearchParams(
	params: URLSearchParams,
): MediaFilterState {
	const genres = params.get("genres");
	const difficulties = params.get("difficulties");
	const minRating = params.get("minRating");
	const maxRating = params.get("maxRating");
	const minRuntime = params.get("minRuntime");
	const maxRuntime = params.get("maxRuntime");
	return {
		includedGenres: new Set(genres ? genres.split(",") : []),
		minRating: minRating !== null ? Number(minRating) : null,
		maxRating: maxRating !== null ? Number(maxRating) : null,
		minRuntime: minRuntime !== null ? Number(minRuntime) : null,
		maxRuntime: maxRuntime !== null ? Number(maxRuntime) : null,
		includedDifficulties: new Set(
			difficulties ? difficulties.split(",").map(Number) : [],
		),
	};
}

// Mutates `params` in place to match `filter`, clearing any key that's back to its default so an unfiltered view keeps a clean URL.
export function applyMediaFilterToSearchParams(
	filter: MediaFilterState,
	params: URLSearchParams,
): void {
	if (filter.includedGenres.size > 0) {
		params.set("genres", [...filter.includedGenres].join(","));
	} else {
		params.delete("genres");
	}
	if (filter.minRating != null)
		params.set("minRating", String(filter.minRating));
	else params.delete("minRating");
	if (filter.maxRating != null)
		params.set("maxRating", String(filter.maxRating));
	else params.delete("maxRating");
	if (filter.minRuntime != null)
		params.set("minRuntime", String(filter.minRuntime));
	else params.delete("minRuntime");
	if (filter.maxRuntime != null)
		params.set("maxRuntime", String(filter.maxRuntime));
	else params.delete("maxRuntime");
	if (filter.includedDifficulties.size > 0) {
		params.set("difficulties", [...filter.includedDifficulties].join(","));
	} else {
		params.delete("difficulties");
	}
}
