"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { ListForm } from "@/components/lists/list-form/list-form";
import { createList } from "@/components/lists/list-actions";
import styles from "./new-list.module.sass";

// Same form as /lists/new, but pre-scoped to one user — reached from their
// /admin/users/[id]/lists page, so there's no "recommend to" picker to fill in.
export default function NewUserListPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();

	return (
		<div className={styles.wrapper}>
			<h1>New list</h1>
			<ListForm
				initial={{
					title: "",
					description: "",
					thumbnailUrl: "",
					sortMode: "RANKED",
					targetUserId: id,
				}}
				submitLabel="Create"
				hideRecommendTo
				onSubmit={async ({ title, description, thumbnailUrl, sortMode }) => {
					await createList({
						title,
						description: description.trim() || null,
						thumbnailUrl: thumbnailUrl.trim() || null,
						sortMode,
						targetUserId: id,
					});
					router.push(`/admin/users/${id}/lists`);
				}}
			/>
		</div>
	);
}
