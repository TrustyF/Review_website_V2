import { CSSProperties } from "react";
import { List } from "lucide-react";
import { db } from "@/server/db/client";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import { NewListLink } from "@/components/lists/new-list-link/new-list-link";
import styles from "./lists-overview-page.module.sass";

// Server Component for /lists: every list, newest first.
export async function ListsOverviewPage() {
	// targetUserId: null excludes recommendation lists — those are private to whoever they're for.
	const lists = await db.list.findMany({
		where: { targetUserId: null },
		include: { _count: { select: { items: true } } },
		orderBy: { createDate: "desc" },
	});

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1 className={styles.title}>
					<List size={20} className={styles.title_icon} />
					Lists
				</h1>
				<NewListLink />
			</div>

			{lists.length === 0 ? (
				<p className={styles.empty}>No lists yet.</p>
			) : (
				<div className={styles.grid}>
					{lists.map((list, index) => (
						<div
							key={list.id}
							className={styles.item}
							style={{ "--stagger-index": index } as CSSProperties}>
							<ListPreviewCard
								id={list.id}
								title={list.title}
								description={list.description}
								thumbnail={list.thumbnail}
								itemCount={list._count.items}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
