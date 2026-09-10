import { CSSProperties } from "react";
import { List } from "lucide-react";
import { db } from "@/server/db/client";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import { NewListLink } from "@/components/lists/new-list-link/new-list-link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLocale } from "@/lib/i18n/get-locale";
import styles from "./lists-overview-page.module.sass";

// Server Component for /lists: every list, newest first.
export async function ListsOverviewPage() {
	// targetUserId: null excludes recommendation lists — those are private to whoever they're for.
	const [lists, dict, locale] = await Promise.all([
		db.list.findMany({
			where: { targetUserId: null },
			include: { _count: { select: { items: true } } },
			orderBy: { createDate: "desc" },
		}),
		getDictionary(),
		getLocale(),
	]);

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1 className={styles.title}>
					<List size={20} className={styles.title_icon} />
					{dict.nav.lists}
				</h1>
				<NewListLink />
			</div>

			{lists.length === 0 ? (
				<p className={styles.empty}>{dict.lists.empty}</p>
			) : (
				<div className={styles.grid}>
					{lists.map((list, index) => (
						<div
							key={list.id}
							className={styles.item}
							style={{ "--stagger-index": index } as CSSProperties}>
							<ListPreviewCard
								id={list.id}
								// Falls back to English when untranslated, like Review.bodyFr.
								title={locale === "fr" ? (list.titleFr ?? list.title) : list.title}
								description={
									locale === "fr"
										? (list.descriptionFr ?? list.description)
										: list.description
								}
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
