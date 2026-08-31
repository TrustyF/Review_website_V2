import { db } from "@/server/db/client";
import { AddToWatchlistButton } from "./add-to-watchlist-button";

type Props = {
	mediaId: number;
	userId: string;
};

// Split out of media/[id]/page.tsx and wrapped in its own <Suspense> boundary
// there, so a slow watchlist lookup only blocks this toggle, not the rest of the page.
export async function AddToWatchlistButtonSection({ mediaId, userId }: Props) {
	const watchlistItem = await db.watchlistItem.findUnique({
		where: { userId_mediaId: { userId, mediaId } },
	});

	return (
		<AddToWatchlistButton
			mediaId={mediaId}
			initialIsInWatchlist={!!watchlistItem}
		/>
	);
}
