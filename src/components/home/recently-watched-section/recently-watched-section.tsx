import { MediaRecord } from "@/components/media/types";
import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import styles from "./recently-watched-section.module.sass";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";

type Props = {
	items: MediaRecord[];
};

export function RecentlyWatchedSection({ items }: Props) {
	if (items.length === 0) return null;

	return (
		<section className={styles.wrapper}>
			<h2 className={styles.title}>Recently watched</h2>
			<MediaCardDisplayProvider showTitle={false}>
				<OneRowMediaGrid items={items} rows={2} />
			</MediaCardDisplayProvider>
		</section>
	);
}
