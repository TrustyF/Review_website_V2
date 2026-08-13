"use client";
import { MediaRecord } from "@/components/media/types";
import { MediaCardResolver } from "@/components/media/media-cards/media-card/media-card-resolver";
import { useLazyReveal } from "@/components/media/media-grids/lazy-media-grid/use-lazy-reveal";
import styles from "./lazy-media-list.module.sass";

type Props = {
	items: MediaRecord[];
	// Stable id for this list instance — when given, how far the user had
	// scrolled into it survives a back-navigation. Same mechanism as
	// LazyMediaGrid's own restoreKey (see useLazyReveal).
	restoreKey?: string;
};

// LazyMediaGrid's sibling for the full MediaCardShell-sized card (poster +
// title + review body) instead of the compact mini card — a vertical list
// of rows rather than a grid, for a page like AllReviewsListPage where the
// review text itself is the point, not just browsing posters. Shares
// useLazyReveal's reveal-on-scroll bookkeeping with LazyMediaGrid; only the
// rendering (which card, grid vs. list layout) differs.
export function LazyMediaList({ items, restoreKey }: Props) {
	const { visibleCount, sentinelRef } = useLazyReveal(items, restoreKey);

	return (
		<>
			<div className={styles.list}>
				{items.slice(0, visibleCount).map((item) => (
					<div className={styles.item} key={item.id}>
						<MediaCardResolver media={item} />
					</div>
				))}
			</div>
			{visibleCount < items.length && (
				<div className={styles.sentinel} ref={sentinelRef} />
			)}
		</>
	);
}
