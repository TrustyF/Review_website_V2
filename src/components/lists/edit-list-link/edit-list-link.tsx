"use client";
import Link from "next/link";
import { useIsAdminStore } from "@/lib/is-admin-store";
import styles from "./edit-list-link.module.sass";

type Props = {
	listId: number;
};

export function EditListLink({ listId }: Props) {
	const isAdmin = useIsAdminStore((s) => s.isAdmin);
	if (!isAdmin) return null;

	return (
		<Link href={`/lists/${listId}/edit`} className={styles.edit_link}>
			Edit
		</Link>
	);
}
