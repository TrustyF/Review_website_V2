import { MediaRecord } from "@/components/media/types";
import { MediaPoster } from "@/components/media/primitives/poster";
import styles from "./watchlist-stack.module.sass";

// Fixed count, not however many fit — a quick preview, not an exhaustive list.
const MAX_VISIBLE = 5;

// Matches .card's aspect-ratio, so the overlap math can predict each card's width.
const RATIO = 2 / 3;

type Props = {
	media: MediaRecord[];
};

// Compact, non-interactive preview for the account dashboard's grid cell —
// no mediaId means no individual poster links; the whole panel around this
// is the click target instead.
//
// Overlap uses a computed negative margin-left rather than manual
// width/left percentages, so the deck always spans the box edge-to-edge.
export function WatchlistStack({ media }: Props) {
	const visible = media.slice(0, MAX_VISIBLE);
	const count = visible.length;

	return (
		<div className={styles.stack}>
			{visible.map((item, i) => (
				<div
					key={item.id}
					className={styles.card}
					style={{
						// Most recently added (index 0) sits frontmost.
						zIndex: count - i,
						...(i > 0 && {
							// Solves for the margin that makes `count` cards span exactly
							// 100cqw total, overlapping or spacing out as needed.
							marginLeft: `calc((100cqw - ${count} * ${RATIO} * 100cqh) / ${count - 1})`,
						}),
					}}>
					<MediaPoster src={item.posterSrc} title={item.title} />
				</div>
			))}
		</div>
	);
}
