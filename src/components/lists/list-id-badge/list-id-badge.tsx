"use client";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import styles from "./list-id-badge.module.sass";

type Props = {
	listId: number;
};

// Admin-only — mainly useful for copying an id into add-movies-to-list.ts's
// listId arg without having to go dig it out of the DB/URL by hand.
export function ListIdBadge({ listId }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported (see nav-admin-links.tsx
	// for the same rule applied to the navbar's own admin links).
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	if (!isAdmin) return null;

	return <span className={styles.badge}>#{listId}</span>;
}
