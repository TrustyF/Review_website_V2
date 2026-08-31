"use client";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import styles from "./list-id-badge.module.sass";

type Props = {
	listId: number;
};

// Admin-only — for copying an id into add-movies-to-list.ts's listId arg without digging through the DB/URL.
export function ListIdBadge({ listId }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	if (!isAdmin) return null;

	return <span className={styles.badge}>#{listId}</span>;
}
