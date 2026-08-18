import { db } from "@/server/db/client";
import { AddToWatchlistButton } from "./add-to-watchlist-button";

type Props = {
	mediaId: number;
	userId: string;
};

// Split out of media/[id]/page.tsx so this query doesn't gate the rest of
// the page's own render — wrapped in its own <Suspense> boundary there
// (only for signed-in visitors; page.tsx itself still decides whether to
// render this section at all from auth(), which is JWT-only and never hits
// the DB), so a slow watchlist lookup only ever blocks this one small toggle
// button, not the banner/title/credits/change-log content.
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
