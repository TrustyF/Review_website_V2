import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { AddMediaToList } from "@/components/lists/add-media-to-list/add-media-to-list";
import { ListMediaGrid } from "@/components/lists/list-media-grid/list-media-grid";
import { EditListLink } from "@/components/lists/edit-list-link/edit-list-link";
import styles from "./list-detail-page.module.sass";

type Props = {
	id: number;
};

// Server Component for /lists/[id] — mirrors credit-media-list-page.tsx's
// shape (look up the grouping entity, notFound() if missing, render its
// media as a grid) but the media set here comes from ListItem membership
// the user curated by hand, not a derived query.
export async function ListDetailPage({ id }: Props) {
	const list = await db.list.findUnique({
		where: { id },
		include: {
			items: {
				orderBy: { addedAt: "asc" },
				include: {
					media: {
						include: {
							movie: true,
							tvShow: true,
							manga: true,
							comic: true,
							game: true,
							review: true,
							// For MediaFilterPopover's genre filter (see list-media-grid.tsx).
							mediaGenres: { include: { genre: true } },
						},
					},
				},
			},
		},
	});
	if (!list) notFound();

	const media = list.items
		.filter((item) => !item.media.isDeleted)
		.map((item) => toMediaRecord(item.media));

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				{list.thumbnail && (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={list.thumbnail} alt="" className={styles.thumbnail} />
				)}
				<div className={styles.header_info}>
					<div className={styles.title_row}>
						<h1>{list.title}</h1>
						<EditListLink listId={list.id} />
					</div>
					{list.description && (
						<p className={styles.description}>{list.description}</p>
					)}
					<Link href="/lists" className={styles.back_link}>
						All lists
					</Link>
				</div>
			</div>

			<AddMediaToList listId={list.id} />

			{media.length === 0 ? (
				<p className={styles.empty}>No media in this list yet.</p>
			) : (
				<ListMediaGrid listId={list.id} media={media} />
			)}
		</div>
	);
}
