"use client";
import { useState } from "react";
import { Clock } from "lucide-react";
import { addToWatchlist, removeFromWatchlist } from "@/components/watchlist/watchlist-actions";
import { Clickable } from "@/components/ui/clickable";
import styles from "./add-to-watchlist-button.module.sass";

type Props = {
	mediaId: number;
	initialIsInWatchlist: boolean;
	className?: string | undefined;
};

// Signed-out visitors never see this; only rendered when there's a session.
// Single boolean toggle rather than a popover, since there's only one destination.
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

	const label = isInWatchlist ? "In watchlist" : "Add to watchlist";

	return (
		<Clickable
			className={className ? `${styles.trigger} ${className}` : styles.trigger}
			disabled={isPending}
			aria-pressed={isInWatchlist}
			title={label}
			aria-label={label}
			onClick={toggle}>
			<Clock size={15} />
		</Clickable>
	);
}
