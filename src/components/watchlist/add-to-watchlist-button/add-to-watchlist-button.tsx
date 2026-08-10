"use client";
import { useState } from "react";
import { addToWatchlist, removeFromWatchlist } from "@/components/watchlist/watchlist-actions";
import styles from "./add-to-watchlist-button.module.sass";

type Props = {
	mediaId: number;
	initialIsInWatchlist: boolean;
	className?: string | undefined;
};

// Signed-out visitors never see this — media/[id]/page.tsx only renders it
// when there's a session, same as AddToListButton's own isAdmin gate.
// Single boolean toggle rather than a popover, since there's only ever one
// destination (this account's own watchlist), not a set of lists to pick
// from.
export function AddToWatchlistButton({
	mediaId,
	initialIsInWatchlist,
	className,
}: Props) {
	const [isInWatchlist, setIsInWatchlist] = useState(initialIsInWatchlist);
	const [isPending, setIsPending] = useState(false);

	async function toggle() {
		const wasInWatchlist = isInWatchlist;
		setIsPending(true);
		setIsInWatchlist(!wasInWatchlist);
		try {
			if (wasInWatchlist) await removeFromWatchlist(mediaId);
			else await addToWatchlist(mediaId);
		} catch {
			setIsInWatchlist(wasInWatchlist);
		} finally {
			setIsPending(false);
		}
	}

	return (
		<button
			type="button"
			className={className ? `${styles.trigger} ${className}` : styles.trigger}
			disabled={isPending}
			aria-pressed={isInWatchlist}
			onClick={toggle}>
			{isInWatchlist ? "In watchlist" : "Add to watchlist"}
		</button>
	);
}
