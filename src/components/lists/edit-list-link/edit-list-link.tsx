"use client";
import { Link } from "@/components/ui/link";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import styles from "./edit-list-link.module.sass";

type Props = {
	listId: number;
};

export function EditListLink({ listId }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	if (!isAdmin) return null;

	return (
		<Link href={`/lists/${listId}/edit`} className={styles.edit_link}>
			Edit
		</Link>
	);
}
