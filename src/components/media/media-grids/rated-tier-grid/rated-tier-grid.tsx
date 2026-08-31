"use client";
import { memo, ReactNode, useMemo } from "react";
import { MediaRecord } from "@/components/media/types";
import {
	GroupedMediaGrid,
	MediaGroup,
} from "@/components/media/media-grids/grouped-media-grid/grouped-media-grid";
import { StarIcon } from "@/components/media/icons/star-icon";

// Whole-point tiers, not half-point, to avoid twenty collapsible sections. Unrated media get their own tier at the end.
function ratingTierOf(media: MediaRecord): number | null {
	const rating = media.review?.rating;
	if (rating == null) return null;
	return Math.floor(rating);
}

function tierLabel(tier: number | null): string {
	if (tier === null) return "Unrated";
	if (tier >= 10) return "10";
	return `${tier}`;
}

type Props = {
	media: MediaRecord[];
	// Forwarded straight through to each tier's own LazyMediaGrid.
	renderOverlay?: ((item: MediaRecord) => ReactNode) | undefined;
};

// Groups media into rating tiers, highest first (Unrated last), via GroupedMediaGrid. memo() + useMemo() keep a slider-drag re-render (before the debounced filter settles) from redoing the sort/bucket pass.
export const RatedTierGrid = memo(function RatedTierGrid({
	media,
	renderOverlay,
}: Props) {
	const groups = useMemo((): MediaGroup[] => {
		const sorted = [...media].sort(
			(a, b) => (b.review?.rating ?? -1) - (a.review?.rating ?? -1),
		);

		const tiers = new Map<number | null, MediaRecord[]>();
		for (const item of sorted) {
			const tier = ratingTierOf(item);
			const bucket = tiers.get(tier);
			if (bucket) bucket.push(item);
			else tiers.set(tier, [item]);
		}
		const orderedTiers = [...tiers.entries()].sort(([a], [b]) => {
			if (a === null) return 1;
			if (b === null) return -1;
			return b - a;
		});

		return orderedTiers.map(([tier, items]) => ({
			key: tier === null ? "unrated" : String(tier),
			label: (
				<>
					<StarIcon size={17} />
					{tierLabel(tier)}
				</>
			),
			items,
		}));
	}, [media]);

	return <GroupedMediaGrid groups={groups} renderOverlay={renderOverlay} />;
});
