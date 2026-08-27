"use client";
import { ReactNode } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaMiniCardResolver } from "@/components/media/media-cards/media-mini-card/media-mini-card-resolver";
import { useLazyReveal } from "@/components/media/media-grids/lazy-media-grid/use-lazy-reveal";
import styles from "./lazy-media-grid.module.sass";

type Props = {
	items: MediaRecord[];
	// Stable id for this grid instance (e.g. a rating tier) — when given,
	// how far the user had scrolled into it survives a back-navigation.
	restoreKey?: string;
	// Per-item action overlay (e.g. a list's admin-only "remove" button) —
	// optional and unused by every caller except list-media-view.tsx; neither
	// MediaFilterGrid nor RecentMediaListPage's items have anything list-
	// specific to render here.
	renderOverlay?: ((item: MediaRecord) => ReactNode) | undefined;
};

// A grid that reveals more cards as the sentinel scrolls into view, instead
// of mounting every item up front. Shared by RatedTierGrid (one instance per
// tier) and RecentMediaListPage (one flat instance) — both hand it a list
// that can run into the hundreds.
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
