"use client";
import { MediaRecord } from "@/components/media/types";
import { RatedTierGrid } from "@/components/media/media-grids/rated-tier-grid/rated-tier-grid";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { useListItemRemoval } from "@/components/lists/use-list-item-removal";
import { useMediaFilter } from "@/components/media/media-grids/media-filter/use-media-filter";
import { MediaFilterPopover } from "@/components/media/media-grids/media-filter/media-filter-popover";
import styles from "./list-media-view.module.sass";

type Props = {
	listId: number;
	media: MediaRecord[];
	sortMode: "RATED" | "UNSORTED";
};

// Handles the two non-RANKED sort modes (RankedList covers RANKED); RATED reuses RatedTierGrid, UNSORTED reuses LazyMediaGrid directly. Neither grid has a built-in "remove from list", so it's supplied via renderOverlay.
export function ListMediaView({ listId, media, sortMode }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const { removingId, handleRemove } = useListItemRemoval(listId);
	const { filter, setFilter, filteredMedia } = useMediaFilter(media);

	const renderOverlay = isAdmin
		? (item: MediaRecord) => (
				<button
					type="button"
					className={styles.remove_button}
					data-reveal-on-hover
					aria-label={`Remove ${item.title} from list`}
					disabled={removingId === item.id}
					onClick={() => handleRemove(item.id)}>
					×
				</button>
			)
		: undefined;

	return (
		<div className={styles.wrapper}>
			<MediaFilterPopover media={media} filter={filter} onChange={setFilter} />
			{filteredMedia.length === 0 ? (
				<p className={styles.empty}>No media matches the current filter.</p>
			) : sortMode === "RATED" ? (
				<RatedTierGrid media={filteredMedia} renderOverlay={renderOverlay} />
			) : (
				<LazyMediaGrid items={filteredMedia} renderOverlay={renderOverlay} />
			)}
		</div>
	);
}
