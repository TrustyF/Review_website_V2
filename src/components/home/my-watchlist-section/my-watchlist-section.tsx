import { MediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import styles from "./my-watchlist-section.module.sass";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";

type Props = {
	items: MediaRecord[];
};

// The ADMIN account's watchlist, not the visitor's — see getMyWatchlist in page.tsx.
export function MyWatchlistSection({ items }: Props) {
	if (items.length === 0) return null;

	return (
		<section className={styles.wrapper}>
			<h2 className={styles.title}>My watchlist</h2>
			<MediaCardDisplayProvider showTitle={false}>
				<LazyMediaGrid items={items} restoreKey="home-my-watchlist" />
			</MediaCardDisplayProvider>
		</section>
	);
}
