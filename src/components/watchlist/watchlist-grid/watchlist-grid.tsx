"use client";
import { useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { removeFromWatchlist } from "@/components/watchlist/watchlist-actions";
import styles from "./watchlist-grid.module.sass";

type Props = {
	media: MediaRecord[];
};

// Every item here belongs to the signed-in visitor's own watchlist, so
// unlike ListMediaView's remove button this has no isAdmin gate — being
// signed in and viewing /watchlist is itself the permission.
export function WatchlistGrid({ media }: Props) {
	const [removingId, setRemovingId] = useState<number | null>(null);

	async function handleRemove(mediaId: number) {
		setRemovingId(mediaId);
		try {
			await removeFromWatchlist(mediaId);
		} finally {
			setRemovingId(null);
		}
	}

	return (
		<LazyMediaGrid
			items={media}
			renderOverlay={(item) => (
				<button
					type="button"
					className={styles.remove_button}
					data-reveal-on-hover
					aria-label={`Remove ${item.title} from watchlist`}
					disabled={removingId === item.id}
					onClick={() => handleRemove(item.id)}>
					×
				</button>
			)}
		/>
	);
}
