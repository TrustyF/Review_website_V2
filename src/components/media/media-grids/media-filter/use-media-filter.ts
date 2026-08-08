"use client";
import { useEffect, useMemo, useState } from "react";
import { MediaRecord } from "@/components/media/types";
import {
	EMPTY_MEDIA_FILTER,
	FILTER_DEBOUNCE_MS,
	matchesMediaFilter,
	MediaFilterState,
} from "@/components/media/media-grids/media-filter/media-filter";

// Shared by every grid that hangs a MediaFilterPopover off a list of media
// (MediaFilterGrid, ListMediaGrid) — owns the filter state and the popover's
// live/debounced split: the popover always reflects `filter` immediately so
// a dragged slider handle tracks the pointer with no lag, while
// `filteredMedia` lags behind by FILTER_DEBOUNCE_MS so a drag doesn't
// re-filter the whole list on every tick. Genres/available-fields are
// MediaFilterPopover's own concern (it derives them straight from the
// `media` it's handed), not this hook's.
export function useMediaFilter(media: MediaRecord[]) {
	const [filter, setFilter] = useState<MediaFilterState>(EMPTY_MEDIA_FILTER);

	const [debouncedFilter, setDebouncedFilter] = useState(filter);
	useEffect(() => {
		const handle = setTimeout(
			() => setDebouncedFilter(filter),
			FILTER_DEBOUNCE_MS,
		);
		return () => clearTimeout(handle);
	}, [filter]);

	const filteredMedia = useMemo(
		() => media.filter((item) => matchesMediaFilter(item, debouncedFilter)),
		[media, debouncedFilter],
	);

	return { filter, setFilter, filteredMedia };
}
