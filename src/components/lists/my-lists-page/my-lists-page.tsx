import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./my-lists-page.module.sass";

// Server Component for /account/lists: every recommendation list targeting the signed-in user; the click-through for account/page.tsx's recommendations panel.
export async function MyListsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");
	const dict = await getDictionary();

	const lists = await db.list.findMany({
		where: { targetUserId: session.user.id },
		include: { _count: { select: { items: true } } },
		orderBy: { createDate: "desc" },
	});

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1>{dict.account.recommendations}</h1>
			</div>

			{lists.length === 0 ? (
				<p className={styles.empty}>{dict.account.recommendationsEmpty}</p>
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
