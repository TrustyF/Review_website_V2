"use client";
import { useIsAdminStore } from "@/lib/is-admin-store";
import styles from "./list-id-badge.module.sass";

type Props = {
	listId: number;
};

// Admin-only — mainly useful for copying an id into add-movies-to-list.ts's
// listId arg without having to go dig it out of the DB/URL by hand.
export function ListIdBadge({ listId }: Props) {
	const isAdmin = useIsAdminStore((s) => s.isAdmin);
	if (!isAdmin) return null;

	return <span className={styles.badge}>#{listId}</span>;
}
