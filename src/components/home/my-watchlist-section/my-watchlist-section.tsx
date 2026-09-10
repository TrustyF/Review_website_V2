import { MediaRecord } from "@/components/media/types";
import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./my-watchlist-section.module.sass";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";

type Props = {
	items: MediaRecord[];
};

// The ADMIN account's watchlist, not the visitor's — see getMyWatchlist in page.tsx.
export async function MyWatchlistSection({ items }: Props) {
	if (items.length === 0) return null;
	const dict = await getDictionary();

	return (
		<section className={styles.wrapper}>
			<h2 className={styles.title}>{dict.watchlist.title}</h2>
			<MediaCardDisplayProvider showTitle={false}>
				<OneRowMediaGrid items={items} />
			</MediaCardDisplayProvider>
		</section>
	);
}
