import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { WatchlistGrid } from "@/components/watchlist/watchlist-grid/watchlist-grid";
import styles from "./watchlist-page.module.sass";

// Same shape as ListDetailPage, but scoped to the signed-in user and always
// newest-first, so no sortMode/RankedList branch is needed.
export async function WatchlistPage() {
	const session = await auth();
	if (!session?.user) redirect("/login");

	const items = await db.watchlistItem.findMany({
		where: { userId: session.user.id },
		orderBy: { addedAt: "desc" },
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
					mediaGenres: { include: { genre: true } },
				},
			},
		},
	});

	const media = items
		.filter((item) => !item.media.isDeleted)
		.map((item) => toMediaRecord(item.media));

	return (
		<div className={styles.wrapper}>
			<h1>My watchlist</h1>
			{media.length === 0 ? (
				<p className={styles.empty}>
					Your watchlist is empty — add something from its media page.
				</p>
			) : (
				<WatchlistGrid media={media} />
			)}
		</div>
	);
}
