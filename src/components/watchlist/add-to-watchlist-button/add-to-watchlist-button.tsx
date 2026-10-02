"use client";
import { Clock } from "lucide-react";
import { useWatchlist } from "@/components/watchlist/watchlist-context";
import { Clickable } from "@/components/ui/clickable";
import { Tip } from "@/components/tips/tip/tip";
import { useDictionary } from "@/lib/i18n/i18n-context";
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
	const dict = useDictionary();
	// Shared context (not local state) so marking watched elsewhere clears this too.
	const watchlist = useWatchlist();
	const isInWatchlist = watchlist.ready
		? watchlist.isInWatchlist(mediaId)
		: initialIsInWatchlist;

	const label = isInWatchlist
		? dict.watchlist.inWatchlist
		: dict.watchlist.addToWatchlist;

	return (
		<Tip id="watchlist" text={dict.tips.watchlist}>
			<Clickable
				className={
					className ? `${styles.trigger} ${className}` : styles.trigger
				}
				disabled={!watchlist.ready}
				aria-pressed={isInWatchlist}
				title={label}
				aria-label={label}
				onClick={() => watchlist.toggle(mediaId)}>
				<Clock size={16} />
			</Clickable>
		</Tip>
	);
}
