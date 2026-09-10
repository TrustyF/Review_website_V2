"use client";
import { useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { removeFromWatchlist } from "@/components/watchlist/watchlist-actions";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./watchlist-grid.module.sass";

type Props = {
	media: MediaRecord[];
};

// No isAdmin gate needed — being signed in and viewing /watchlist is itself the permission.
export function WatchlistGrid({ media }: Props) {
	const dict = useDictionary();
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
					aria-label={dict.watchlist.removeFromWatchlist(item.title)}
					disabled={removingId === item.id}
					onClick={() => handleRemove(item.id)}>
					×
				</button>
			)}
		/>
	);
}
