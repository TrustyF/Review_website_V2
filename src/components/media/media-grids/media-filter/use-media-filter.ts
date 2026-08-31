"use client";
import { useEffect, useMemo, useState } from "react";
import { MediaRecord } from "@/components/media/types";
import {
	EMPTY_MEDIA_FILTER,
	FILTER_DEBOUNCE_MS,
	matchesMediaFilter,
	MediaFilterState,
} from "@/components/media/media-grids/media-filter/media-filter";

// Owns filter state and the live/debounced split: `filter` updates immediately so the slider tracks the pointer, `filteredMedia` lags by FILTER_DEBOUNCE_MS to avoid re-filtering on every tick.
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
