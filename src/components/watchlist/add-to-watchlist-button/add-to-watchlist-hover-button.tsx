"use client";
import { Clock } from "lucide-react";
import { useSession } from "next-auth/react";
import { useWatchlist } from "@/components/watchlist/watchlist-context";
import { Clickable } from "@/components/ui/clickable";
import { Tooltip } from "@/components/ui/tooltip";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "@/components/media/media-cards/media-mini-card/media-hover-badge.module.sass";

type Props = {
	mediaId: number;
	className?: string | undefined;
};

// Quick-add toggle for media cards in a grid; signed-out visitors never see this.
// Reads/writes through WatchlistProvider so every card for the same media stays in sync.
export function AddToWatchlistHoverButton({ mediaId, className }: Props) {
	const dict = useDictionary();
	const { data: session } = useSession();
	const { isInWatchlist, toggle } = useWatchlist();

	if (!session?.user?.id) return null;

	const inWatchlist = isInWatchlist(mediaId);
	const label = inWatchlist ? dict.watchlist.inWatchlist : dict.watchlist.addToWatchlist;

	return (
		<Tooltip content={label} className={styles.trigger}>
			<Clickable
				className={className ? `${styles.badge} ${className}` : styles.badge}
				aria-pressed={inWatchlist}
				aria-label={label}
				onClick={() => toggle(mediaId)}>
				<Clock size={16} />
			</Clickable>
		</Tooltip>
	);
}
