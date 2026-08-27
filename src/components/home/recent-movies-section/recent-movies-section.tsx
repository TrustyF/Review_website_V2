import { MediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import styles from "./recent-movies-section.module.sass";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";

type Props = {
	items: MediaRecord[];
};

export function RecentMoviesSection({ items }: Props) {
	if (items.length === 0) return null;

	return (
		<section className={styles.wrapper}>
			<h2 className={styles.title}>Recent releases</h2>
			<MediaCardDisplayProvider showTitle={false}>
				<LazyMediaGrid
					items={items}
					restoreKey="home-recent-movies"
					singleRow
				/>
			</MediaCardDisplayProvider>
		</section>
	);
}
