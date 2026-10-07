import { WatchlistIcon } from "@/components/icons/watchlist-icon";
import { db } from "@/server/db/client";
import { toMediaCardRecord, toMediaRecord } from "@/components/media/types";
import { HomeMediaRow } from "@/components/home/home-media-row";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const YOUR_WATCHLIST_COUNT = 14;

type Props = {
	userId: string;
};

// The signed-in visitor's own watchlist — MyWatchlistSection is the admin's.
export async function YourWatchlistSection({ userId }: Props) {
	const [items, dict] = await Promise.all([
		db.watchlistItem.findMany({
			where: { userId, media: { isDeleted: false } },
			include: {
				media: {
					include: {
						movie: true,
						tvShow: true,
						manga: true,
						comic: true,
						game: true,
						book: true,
						review: true,
					},
				},
			},
			orderBy: { addedAt: "desc" },
			take: YOUR_WATCHLIST_COUNT,
		}),
		getDictionary(),
	]);

	return (
		<HomeMediaRow
			icon={WatchlistIcon}
			title={dict.home.yourWatchlist}
			subtitle={dict.home.subtitles.yourWatchlist}
			items={items.map((item) => toMediaCardRecord(toMediaRecord(item.media)))}
			seeAll={{ href: "/watchlist", label: dict.home.seeAll }}
		/>
	);
}
