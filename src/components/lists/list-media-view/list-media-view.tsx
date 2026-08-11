"use client";
import { MediaRecord } from "@/components/media/types";
import { RatedTierGrid } from "@/components/media/media-grids/rated-tier-grid/rated-tier-grid";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useListItemRemoval } from "@/components/lists/use-list-item-removal";
import { useMediaFilter } from "@/components/media/media-grids/media-filter/use-media-filter";
import { MediaFilterPopover } from "@/components/media/media-grids/media-filter/media-filter-popover";
import styles from "./list-media-view.module.sass";

type Props = {
	listId: number;
	media: MediaRecord[];
	sortMode: "RATED" | "UNSORTED";
};

// RANKED lists get RankedList's own drag-to-reorder view — this handles the
// other two modes, which share everything except which existing grid does
// the actual layout: RATED reuses RatedTierGrid (the same tiered view
// /movies etc. already show), UNSORTED reuses LazyMediaGrid directly with
// no tiering. Neither one has any built-in notion of "remove from list", so
// that's supplied here via renderOverlay (see LazyMediaGrid's own note).
export function ListMediaView({ listId, media, sortMode }: Props) {
	const isAdmin = useIsAdmin();
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
