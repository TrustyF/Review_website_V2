"use client";
import { useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaMiniCardResolver } from "@/components/media/media-cards/media-mini-card/media-mini-card-resolver";
import { removeMediaFromList } from "@/components/lists/list-actions";
import { useIsAdminStore } from "@/lib/is-admin-store";
import { useMediaFilter } from "@/components/media/media-grids/media-filter/use-media-filter";
import { MediaFilterPopover } from "@/components/media/media-grids/media-filter/media-filter-popover";
import styles from "./list-media-grid.module.sass";

type Props = {
	listId: number;
	media: MediaRecord[];
};

// Plain grid, no infinite scroll (unlike LazyMediaGrid/MediaFilterGrid) — a
// curated list is expected to stay small, so mounting every card up front is
// fine. Each card gets an admin-gated "×" overlay to pull it back out of the
// list, a sibling of MediaMiniCardResolver rather than wrapped inside it so
// it isn't clipped by anything the card itself does with overflow.
export function ListMediaGrid({ listId, media }: Props) {
	const isAdmin = useIsAdminStore((s) => s.isAdmin);
	const [removingId, setRemovingId] = useState<number | null>(null);
	const { filter, setFilter, filteredMedia } = useMediaFilter(media);

	async function handleRemove(mediaId: number) {
		setRemovingId(mediaId);
		try {
			await removeMediaFromList(listId, mediaId);
		} finally {
			setRemovingId(null);
		}
	}

	return (
		<div>
			<div className={styles.controls}>
				<MediaFilterPopover
					media={media}
					filter={filter}
					onChange={setFilter}
				/>
			</div>
			{filteredMedia.length === 0 ? (
				<p className={styles.empty}>No media matches the current filter.</p>
			) : (
				<div className={styles.grid}>
					{filteredMedia.map((item) => (
						<div className={styles.item} key={item.id}>
							<MediaMiniCardResolver media={item} />
							{isAdmin && (
								<button
									type="button"
									className={styles.remove_button}
									aria-label={`Remove ${item.title} from list`}
									disabled={removingId === item.id}
									onClick={() => handleRemove(item.id)}>
									×
								</button>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
