"use client";
import { memo, ReactNode, useMemo } from "react";
import { MediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import styles from "./rated-tier-grid.module.sass";
import "@/components/media/icons/star-icon.tsx";
import { StarIcon } from "@/components/media/icons/star-icon";

// Buckets media into whole-point rating tiers (9 covers a 9.0-9.5 rating,
// etc.) — halfway steps would mean twenty collapsible sections, too many to
// be useful as a grid overview. Unrated media get their own tier at the end
// rather than being silently dropped.
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
	// Forwarded straight through to each tier's own LazyMediaGrid — see that
	// component's own note on why this exists.
	renderOverlay?: ((item: MediaRecord) => ReactNode) | undefined;
};

// Groups media into rating tiers, highest first (Unrated last), each
// rendered as a collapsible, lazily-revealed grid of mini cards. Its only
// caller (MediaFilterGrid) already memoizes the `media` it passes down
// (use-media-filter.ts's filteredMedia), but that only helps if this
// component actually skips re-rendering when that reference is unchanged —
// without memo() below, React still calls this function on every parent
// re-render regardless, which used to mean redoing the full sort/bucket
// pass on every tick of a filter slider drag even though the list hadn't
// changed. memo() + useMemo() together make an unrelated parent re-render
// (dragging a slider before the debounced filter settles) genuinely free.
export const RatedTierGrid = memo(function RatedTierGrid({
	media,
	renderOverlay,
}: Props) {
	const orderedTiers = useMemo(() => {
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
		return [...tiers.entries()].sort(([a], [b]) => {
			if (a === null) return 1;
			if (b === null) return -1;
			return b - a;
		});
	}, [media]);

	return (
		<div className={styles.tiers}>
			{orderedTiers.map(([tier, items]) => (
				<details key={tier ?? "unrated"} open>
					<summary className={styles.tier_header}>
						<StarIcon size={17} />
						{tierLabel(tier)}
						{/*<span className={styles.tier_count}>- {items.length} items</span>*/}
					</summary>
					<LazyMediaGrid
						items={items}
						restoreKey={tier === null ? "unrated" : String(tier)}
						renderOverlay={renderOverlay}
					/>
				</details>
			))}
		</div>
	);
});
