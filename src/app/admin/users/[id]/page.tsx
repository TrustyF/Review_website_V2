import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Link } from "@/components/ui/link";
import { List } from "lucide-react";
import { db } from "@/server/db/client";
import { getRecommendationTarget } from "@/components/lists/list-actions";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import { displayName } from "@/lib/display-name";
import styles from "./user-overview.module.sass";

// Admin's landing page for a specific user: their identity plus a preview of the
// recommendation lists curated for them, mirroring /account's own lists panel.
export default async function AdminUserOverviewPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") notFound();

	const { id } = await params;
	const target = await getRecommendationTarget(id);
	if (!target) notFound();

	const MAX_VISIBLE_LISTS = 4;
	const listsAll = await db.list.findMany({
		where: { targetUserId: id },
		include: { _count: { select: { items: true } } },
		orderBy: { createDate: "desc" },
	});
	const lists = listsAll.slice(0, MAX_VISIBLE_LISTS);

	const heading = displayName(target);

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				{target.image ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={target.image} alt="" className={styles.avatar} />
				) : (
					<div className={styles.avatar_placeholder} />
				)}
				<div className={styles.identity}>
					<h1 className={styles.name}>{heading}</h1>
					{heading !== target.email && target.email && (
						<p className={styles.email}>{target.email}</p>
					)}
				</div>
			</div>

			<Link href={`/admin/users/${id}/lists`} className={styles.lists}>
				<h2 className={styles.section_title}>
					<List size={18} className={styles.section_icon} />
					Recommendations
				</h2>
				{lists.length === 0 ? (
					<p className={styles.empty}>
						Nothing recommended to this user yet.
					</p>
				) : (
					<div className={styles.lists_stack}>
						{lists.map((list) => (
							<ListPreviewCard
								key={list.id}
								id={list.id}
								title={list.title}
								description={list.description}
								thumbnail={list.thumbnail}
								itemCount={list._count.items}
								linked={false}
							/>
						))}
					</div>
				)}
			</Link>
		</div>
	);
}
