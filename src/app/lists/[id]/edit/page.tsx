import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { EditListForm } from "@/components/lists/edit-list-form/edit-list-form";
import styles from "./edit-list.module.sass";

export default async function EditListPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const listId = Number(id);
	if (!Number.isFinite(listId)) notFound();

	const list = await db.list.findUnique({ where: { id: listId } });
	if (!list) notFound();

	return (
		<div className={styles.wrapper}>
			<h1>Edit list</h1>
			<EditListForm
				listId={list.id}
				initial={{
					title: list.title,
					description: list.description ?? "",
					thumbnailUrl: list.thumbnail ?? "",
				}}
			/>
		</div>
	);
}
