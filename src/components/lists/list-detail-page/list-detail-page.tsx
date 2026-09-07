import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { AddMediaToList } from "@/components/lists/add-media-to-list/add-media-to-list";
import { RankedList } from "@/components/lists/ranked-list/ranked-list";
import { ListMediaView } from "@/components/lists/list-media-view/list-media-view";
import { EditListLink } from "@/components/lists/edit-list-link/edit-list-link";
import { ListIdBadge } from "@/components/lists/list-id-badge/list-id-badge";
import { ListWatchedProgress } from "@/components/lists/list-watched-progress/list-watched-progress";
import { displayName } from "@/lib/display-name";
import styles from "./list-detail-page.module.sass";

type Props = {
	id: number;
};

// Server Component for /lists/[id]; media set comes from hand-curated ListItem membership, not a derived query.
export async function ListDetailPage({ id }: Props) {
	const list = await db.list.findUnique({
		where: { id },
		include: {
			targetUser: { select: { username: true, name: true, email: true } },
			items: {
				orderBy: { rank: "asc" },
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
							// For MediaFilterPopover's genre filter (see ranked-list.tsx).
							mediaGenres: { include: { genre: true } },
						},
					},
				},
			},
		},
	});
	if (!list) notFound();

	const session = await auth();
	const isAdmin = session?.user?.role === "ADMIN";

	// A recommendation list is only visible to its recipient and admins; notFound() (not a login redirect) so a probing visitor can't tell "no such list" from "not yours."
	if (list.targetUserId) {
		const isRecipient = session?.user?.id === list.targetUserId;
		if (!isRecipient && !isAdmin) notFound();
	}

	const media = list.items
		.filter((item) => !item.media.isDeleted)
		.map((item) => toMediaRecord(item.media));

	// Read-only "already seen" badges: only meaningful to an admin browsing someone else's
	// recommendation list — the recipient already knows their own watched state.
	const seenMediaIds = list.targetUserId && isAdmin
		? new Set(
				(
					await db.watchedItem.findMany({
						where: { userId: list.targetUserId },
						select: { mediaId: true },
					})
				).map((item) => item.mediaId),
			)
		: undefined;

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				{list.thumbnail ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={list.thumbnail} alt="" className={styles.thumbnail} />
				) : (
					<div className={styles.thumbnail_placeholder}>
						{list.title.charAt(0)}
					</div>
				)}
				<div className={styles.header_info}>
					<div className={styles.title_row}>
						<h1>{list.title}</h1>
						<ListIdBadge listId={list.id} />
						{/* Admin-only: lets an admin browsing by id/link see at a glance who a recommendation list is for. */}
						{isAdmin && list.targetUser && (
							<span className={styles.recommendation_badge}>
								For {displayName(list.targetUser)}
							</span>
						)}
						<EditListLink listId={list.id} />
					</div>
					{list.description && (
						<p className={styles.description}>{list.description}</p>
					)}
				</div>
				<ListWatchedProgress
					mediaIds={media.map((item) => item.id)}
					className={styles.watched_progress}
				/>
			</div>

			<AddMediaToList
				listId={list.id}
				excludeMediaIds={media.map((item) => item.id)}
				seenMediaIds={seenMediaIds}
			/>

			{media.length === 0 ? (
				<p className={styles.empty}>No media in this list yet.</p>
			) : list.sortMode === "RANKED" ? (
				<RankedList
					listId={list.id}
					media={media}
					seenMediaIds={seenMediaIds}
				/>
			) : (
				<ListMediaView
					listId={list.id}
					media={media}
					sortMode={list.sortMode}
					seenMediaIds={seenMediaIds}
				/>
			)}
		</div>
	);
}
