import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import styles from "./my-lists-page.module.sass";

// Server Component for /account/lists: every admin-curated recommendation
// list targeting the signed-in user, newest first — the click-through
// destination for account/page.tsx's recommendations panel, mirroring how
// /watchlist is the click-through for its watchlist panel.
export async function MyListsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	const lists = await db.list.findMany({
		where: { targetUserId: session.user.id },
		include: { _count: { select: { items: true } } },
		orderBy: { createDate: "desc" },
	});

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1>Recommendations</h1>
			</div>

			{lists.length === 0 ? (
				<p className={styles.empty}>
					Nothing recommended yet — lists an admin curates for you specifically
					will show up here.
				</p>
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
