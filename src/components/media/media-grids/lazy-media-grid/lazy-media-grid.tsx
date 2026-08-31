"use client";
import { ReactNode } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaMiniCardResolver } from "@/components/media/media-cards/media-mini-card/media-mini-card-resolver";
import { useLazyReveal } from "@/components/media/media-grids/lazy-media-grid/use-lazy-reveal";
import styles from "./lazy-media-grid.module.sass";

type Props = {
	items: MediaRecord[];
	// Stable id for this grid instance; when given, scroll depth survives a back-navigation.
	restoreKey?: string;
	// Per-item action overlay (e.g. a list's "remove" button); only list-media-view.tsx uses it.
	renderOverlay?: ((item: MediaRecord) => ReactNode) | undefined;
};

// Reveals more cards as the sentinel scrolls into view instead of mounting everything up front.
export function LazyMediaGrid({ items, restoreKey, renderOverlay }: Props) {
	const { visibleCount, sentinelRef } = useLazyReveal(items, restoreKey);

	return (
		<>
			<div className={styles.grid}>
				{items.slice(0, visibleCount).map((item) => (
					<div className={styles.item} key={item.id}>
						<MediaMiniCardResolver media={item} />
						{renderOverlay?.(item)}
					</div>
				))}
			</div>
			{visibleCount < items.length && (
				<div className={styles.sentinel} ref={sentinelRef} />
			)}
		</>
	);
}
