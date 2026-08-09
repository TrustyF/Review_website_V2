"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	ListForm,
	ListFormValues,
} from "@/components/lists/list-form/list-form";
import { deleteList, updateList } from "@/components/lists/list-actions";
import styles from "./edit-list-form.module.sass";

type Props = {
	listId: number;
	initial: ListFormValues;
};

export function EditListForm({ listId, initial }: Props) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	async function handleDelete() {
		if (!confirm("Delete this list? This cannot be undone.")) return;
		setIsDeleting(true);
		setDeleteError(null);
		try {
			await deleteList(listId);
			router.push("/lists");
		} catch {
			setDeleteError("Failed to delete. Try again.");
			setIsDeleting(false);
		}
	}

	return (
		<ListForm
			initial={initial}
			submitLabel="Save"
			onSubmit={async ({ title, description, thumbnailUrl, sortMode }) => {
				await updateList(listId, {
					title,
					description: description.trim() || null,
					thumbnailUrl: thumbnailUrl.trim() || null,
					sortMode,
				});
				router.push(`/lists/${listId}`);
			}}
			extra={
				<div className={styles.danger_zone}>
					<button
						type="button"
						className={styles.delete_button}
						onClick={handleDelete}
						disabled={isDeleting}>
						{isDeleting ? "Deleting…" : "Delete list"}
					</button>
					{deleteError && <div className={styles.error}>{deleteError}</div>}
				</div>
			}
		/>
	);
}
