import { MediaRecord } from "@/components/media/types";
import { MediaPoster } from "@/components/media/primitives/poster";
import styles from "./watchlist-stack.module.sass";

// Fixed at 3 rather than however many happen to fit — the point is a quick
// "here's what's freshest" preview, not an exhaustive list (that's what
// clicking through to /watchlist is for).
const MAX_VISIBLE = 5;

// Matches .card's own aspect-ratio in watchlist-stack.module.sass (and
// MediaPoster's own default ratio prop) — needed here too so the overlap
// math below can predict each card's width from the container's height.
const RATIO = 2 / 3;

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
//
// Cards are flex: 1 with a negative margin-left overlap (see
// watchlist-stack.module.sass's .card) rather than manually computed
// width/left percentages — flex-grow naturally redistributes the space
// the negative margins free up, so the deck always ends up spanning the
// box's full width edge-to-edge regardless of how many cards there are,
// without this component having to do that math itself.
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
						// Most recently added (index 0) sits frontmost, on top of and
						// to the left of the rest of the deck.
						zIndex: count - i,
						...(i > 0 && {
							// Solves for the margin that makes `count` cards (each
							// RATIO * 100cqh wide) span exactly 100cqw total: negative
							// when their natural combined width is wider than the
							// container (overlapping — the common case), positive if
							// narrower (spacing them out instead). Either way the deck
							// always fills the container's width edge-to-edge.
							marginLeft: `calc((100cqw - ${count} * ${RATIO} * 100cqh) / ${count - 1})`,
						}),
					}}>
					<MediaPoster src={item.posterSrc} title={item.title} />
				</div>
			))}
		</div>
	);
}
