import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Link } from "@/components/ui/link";
import { db } from "@/server/db/client";
import { getRecommendationTarget } from "@/components/lists/list-actions";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import { displayName } from "@/lib/display-name";
import styles from "./user-lists.module.sass";

// Full grid of one user's recommendation lists, reached from /admin/users/[id]. "New list"
// here is pre-scoped to this user via /admin/users/[id]/lists/new.
export default async function AdminUserListsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") notFound();

	const { id } = await params;
	const target = await getRecommendationTarget(id);
	if (!target) notFound();

	const lists = await db.list.findMany({
		where: { targetUserId: id },
		include: { _count: { select: { items: true } } },
		orderBy: { createDate: "desc" },
	});

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1>Recommendations for {displayName(target)}</h1>
				<Link href={`/admin/users/${id}/lists/new`} className={styles.new_link}>
					New list
				</Link>
			</div>

			{lists.length === 0 ? (
				<p className={styles.empty}>Nothing recommended to this user yet.</p>
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
