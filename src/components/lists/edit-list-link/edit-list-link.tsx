"use client";
import Link from "next/link";
import { useIsAdmin } from "@/lib/use-is-admin";
import styles from "./edit-list-link.module.sass";

type Props = {
	listId: number;
};

export function EditListLink({ listId }: Props) {
	const isAdmin = useIsAdmin();
	if (!isAdmin) return null;

	return (
		<Link href={`/lists/${listId}/edit`} className={styles.edit_link}>
			Edit
		</Link>
	);
}
