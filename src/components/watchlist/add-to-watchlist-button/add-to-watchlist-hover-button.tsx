"use client";
import { Clock } from "lucide-react";
import { useSession } from "next-auth/react";
import { useWatchlist } from "@/components/watchlist/watchlist-context";
import { Clickable } from "@/components/ui/clickable";
import styles from "@/components/media/media-cards/media-mini-card/media-hover-badge.module.sass";

type Props = {
	mediaId: number;
	className?: string | undefined;
};

// Quick-add toggle for media cards in a grid; signed-out visitors never see this.
// Reads/writes through WatchlistProvider so every card for the same media stays in sync.
export function AddToWatchlistHoverButton({ mediaId, className }: Props) {
	const { data: session } = useSession();
	const { isInWatchlist, toggle } = useWatchlist();

	if (!session?.user?.id) return null;

	const inWatchlist = isInWatchlist(mediaId);
	const label = inWatchlist ? "In watchlist" : "Add to watchlist";

	return (
		<Clickable
			className={className ? `${styles.badge} ${className}` : styles.badge}
			aria-pressed={inWatchlist}
			title={label}
			aria-label={label}
			onClick={() => toggle(mediaId)}>
			<Clock size={13} />
		</Clickable>
	);
}
