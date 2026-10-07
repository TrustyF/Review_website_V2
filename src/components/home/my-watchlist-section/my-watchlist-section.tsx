import { WatchlistIcon } from "@/components/icons/watchlist-icon";
import { MediaRecord } from "@/components/media/types";
import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { HomeSectionHeader } from "@/components/home/home-section-header";
import sectionStyles from "@/components/home/home-section.module.sass";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";

type Props = {
	items: MediaRecord[];
};

// The ADMIN account's watchlist, not the visitor's — see getMyWatchlist in page.tsx.
export async function MyWatchlistSection({ items }: Props) {
	if (items.length === 0) return null;
	const dict = await getDictionary();

	return (
		<section className={sectionStyles.wrapper}>
			<HomeSectionHeader
				icon={WatchlistIcon}
				title={dict.watchlist.title}
				subtitle={dict.home.subtitles.myWatchlist}
			/>
			<MediaCardDisplayProvider showTitle={false} fade={false}>
				<OneRowMediaGrid items={items} />
			</MediaCardDisplayProvider>
		</section>
	);
}
