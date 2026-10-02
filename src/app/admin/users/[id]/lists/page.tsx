import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Link } from "@/components/ui/link";
import { db } from "@/server/db/client";
import { getRecommendationTarget } from "@/components/lists/list-actions";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import { displayName } from "@/lib/display-name";
import { getLocale } from "@/lib/i18n/get-locale";
import styles from "./user-lists.module.sass";

// Full grid of one user's recommendation lists, reached from /admin/users/[id]. "New list"
// here is pre-scoped to this user via /admin/users/[id]/lists/new.
export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") return {};
	const target = await getRecommendationTarget((await params).id);
	return target ? { title: `Made for ${displayName(target)}` } : {};
}

export default async function AdminUserListsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") notFound();

	const { id } = await params;
	const [target, locale] = await Promise.all([
		getRecommendationTarget(id),
		getLocale(),
	]);
	if (!target) notFound();

	const lists = await db.list.findMany({
		where: { targetUserId: id },
		include: { _count: { select: { items: true } } },
		orderBy: { createDate: "desc" },
	});

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1>Made for {displayName(target)}</h1>
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
							title={
								locale === "fr" ? (list.titleFr ?? list.title) : list.title
							}
							description={
								locale === "fr"
									? (list.descriptionFr ?? list.description)
									: list.description
							}
							thumbnail={list.thumbnail}
							itemCount={list._count.items}
						/>
					))}
				</div>
			)}
		</div>
	);
}
