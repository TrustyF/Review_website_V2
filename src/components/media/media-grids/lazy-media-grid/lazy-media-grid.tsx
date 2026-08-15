"use client";
import { ReactNode } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaMiniCardResolver } from "@/components/media/media-cards/media-mini-card/media-mini-card-resolver";
import { useLazyReveal } from "@/components/media/media-grids/lazy-media-grid/use-lazy-reveal";
import { useMediaGridColumns } from "@/components/media/media-grids/lazy-media-grid/media-grid-columns-context";
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
	const columns = useMediaGridColumns();

	return (
		<>
			<div
				className={styles.grid}
				style={
					// minmax(0, 1fr) rather than bare 1fr — a bare 1fr track's
					// implicit minimum is auto (its content's own intrinsic size),
					// so a wide poster image would force its column wider than its
					// neighbors instead of every column sharing the row equally.
					columns
						? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
						: undefined
				}>
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
