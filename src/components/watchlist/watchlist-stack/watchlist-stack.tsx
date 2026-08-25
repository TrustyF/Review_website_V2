import { MediaRecord } from "@/components/media/types";
import { MediaPoster } from "@/components/media/primitives/poster";
import styles from "./watchlist-stack.module.sass";

// Fixed at 3 rather than however many happen to fit — the point is a quick
// "here's what's freshest" preview, not an exhaustive list (that's what
// clicking through to /watchlist is for).
const MAX_VISIBLE = 3;

type Props = {
	media: MediaRecord[];
};

// Compact, non-interactive preview of the signed-in user's watchlist for the
// account dashboard's grid cell — no mediaId is passed to MediaPoster, so
// none of the individual posters are links (see poster.tsx's own
// mediaId-omitted branch), and this itself isn't a Link either: the whole
// panel around it (page.tsx's own Link wrapping this component plus the
// section title) is the click target instead, so nowhere in the card reads
// as dead space.
export function WatchlistStack({ media }: Props) {
	const visible = media.slice(0, MAX_VISIBLE);

	return (
		<div className={styles.stack}>
			{visible.map((item) => (
				<div key={item.id} className={styles.card}>
					<MediaPoster src={item.posterSrc} title={item.title} />
				</div>
			))}
		</div>
	);
}
