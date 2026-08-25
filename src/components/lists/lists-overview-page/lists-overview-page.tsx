import { db } from "@/server/db/client";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import { NewListLink } from "@/components/lists/new-list-link/new-list-link";
import styles from "./lists-overview-page.module.sass";

// Server Component for /lists: every list, newest first, grouped together on
// one page — the "dedicated grouping-of-lists page" the feature was asked
// for, mirroring how media-type-list-page.tsx groups media by type.
export async function ListsOverviewPage() {
	// targetUserId: null excludes recommendation lists (see list.prisma's own
	// comment on that field) — those are private to whoever they're for, not
	// part of the site's public catalog.
	const lists = await db.list.findMany({
		where: { targetUserId: null },
		include: { _count: { select: { items: true } } },
		orderBy: { createDate: "desc" },
	});

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1>Lists</h1>
				<NewListLink />
			</div>

			{lists.length === 0 ? (
				<p className={styles.empty}>No lists yet.</p>
			) : (
				<div className={styles.grid}>
					{lists.map((list) => (
						<ListPreviewCard
							key={list.id}
							id={list.id}
							title={list.title}
							description={list.description}
							thumbnail={list.thumbnail}
							itemCount={list._count.items}
						/>
					))}
				</div>
			)}
		</div>
	);
}
