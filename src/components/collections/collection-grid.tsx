"use client";
import type { MediaCardRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { MediaMiniCardResolver } from "@/components/media/media-cards/media-mini-card/media-mini-card-resolver";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import { posterRatioFor } from "@/components/media/poster-ratio";
import styles from "./collection-grid.module.sass";

type Props = {
	items: MediaCardRecord[];
	// Small posters only (media page preview) instead of rated cards (collection page).
	compact?: boolean;
	// Outlined in the compact row (the media page's own movie).
	currentId?: number;
};

// Collection members in watch order.
export function CollectionGrid({ items, compact = false, currentId }: Props) {
	if (!compact)
		return (
			<MediaCardDisplayProvider fade={false} showTitle={false}>
				<LazyMediaGrid items={items} />
			</MediaCardDisplayProvider>
		);

	return (
		<MediaCardDisplayProvider
			fade={false}
			showTitle={false}
			showRating={false}
			showWatchlistPill={false}>
			<div className={styles.compact}>
				{items.map((item) => (
					<div key={item.id} className={styles.compact_item}>
						<MediaMiniCardResolver media={item} />
						{item.id === currentId && (
							<span
								className={styles.current_ring}
								style={{ aspectRatio: posterRatioFor(item.type) }}
							/>
						)}
					</div>
				))}
			</div>
		</MediaCardDisplayProvider>
	);
}
