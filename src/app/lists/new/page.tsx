"use client";
import { useRouter } from "next/navigation";
import { ListForm } from "@/components/lists/list-form/list-form";
import { createList } from "@/components/lists/list-actions";
import styles from "./new-list.module.sass";

export default function NewListPage() {
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
					targetUserId: null,
				}}
				submitLabel="Create"
				onSubmit={async ({
					title,
					description,
					thumbnailUrl,
					sortMode,
					targetUserId,
				}) => {
					const id = await createList({
						title,
						description: description.trim() || null,
						thumbnailUrl: thumbnailUrl.trim() || null,
						sortMode,
						targetUserId,
					});
					router.push(`/lists/${id}`);
				}}
			/>
		</div>
	);
}
