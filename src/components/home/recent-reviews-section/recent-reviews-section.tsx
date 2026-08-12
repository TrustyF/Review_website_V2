import { MediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import styles from "./recent-reviews-section.module.sass";

type Props = {
	items: MediaRecord[];
};

export function RecentReviewsSection({ items }: Props) {
	if (items.length === 0) return null;

	return (
		<section className={styles.wrapper}>
			<h2 className={styles.title}>Recent reviews</h2>
			<LazyMediaGrid items={items} restoreKey="home-recent-reviews" />
		</section>
	);
}
