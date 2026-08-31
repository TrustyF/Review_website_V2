"use client";
import { MediaRecord } from "@/components/media/types";
import { MediaCardResolver } from "@/components/media/media-cards/media-card/media-card-resolver";
import { useLazyReveal } from "@/components/media/media-grids/lazy-media-grid/use-lazy-reveal";
import styles from "./lazy-media-list.module.sass";

type Props = {
	items: MediaRecord[];
	// Stable id for this list instance; when given, scroll depth survives a back-navigation.
	restoreKey?: string;
};

// LazyMediaGrid's sibling for the full card (poster + title + review body) as a vertical list instead of a grid.
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
