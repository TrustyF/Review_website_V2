import { MediaType } from "@prisma/client";
import { db } from "@/server/db/client";
import { WatchedButton } from "./watched-button";

type Props = {
	mediaId: number;
	type: MediaType;
	userId: string;
};

// Split out of media/[id]/page.tsx and wrapped in its own <Suspense> boundary
// there, so a slow watched lookup only blocks this toggle, not the rest of the page.
export async function WatchedButtonSection({ mediaId, type, userId }: Props) {
	const watchedItem = await db.watchedItem.findUnique({
		where: { userId_mediaId: { userId, mediaId } },
	});

	return (
		<WatchedButton
			mediaId={mediaId}
			type={type}
			initialIsWatched={!!watchedItem}
		/>
	);
}
