"use client";
import { useMemo } from "react";
import { MediaRecord } from "@/components/media/types";
import { RatedTierGrid } from "@/components/media/media-grids/rated-tier-grid/rated-tier-grid";
import {
	GroupedMediaGrid,
	MediaGroup,
} from "@/components/media/media-grids/grouped-media-grid/grouped-media-grid";
import {
	groupMediaByYear,
	MediaSortOption,
} from "@/components/media/media-grids/media-sort/media-sort";
import { MediaSortIcon } from "@/components/media/media-grids/media-sort/media-sort-icon";

type Props = {
	media: MediaRecord[];
	sort: MediaSortOption;
};

// Picks the grid that matches MediaSortPopover's current selection —
// RatedTierGrid's own tier view for the default "rating", otherwise this
// groups the same media by year (via groupMediaByYear) and hands it to the
// same GroupedMediaGrid RatedTierGrid itself renders through, so a
// release-/watch-date sort reads as "the same kind of grid, bucketed by
// year instead of rating" rather than a different layout entirely.
export function MediaSortedGrid({ media, sort }: Props) {
	const groups = useMemo((): MediaGroup[] => {
		if (sort === "rating") return [];
		return groupMediaByYear(media, sort).map(({ year, items }) => ({
			key: year === null ? "unknown" : String(year),
			label: (
				<>
					<MediaSortIcon option={sort} size={17} />
					{year ?? "Unknown"}
				</>
			),
			items,
		}));
	}, [media, sort]);

	if (sort === "rating") return <RatedTierGrid media={media} />;
	return <GroupedMediaGrid groups={groups} />;
}
