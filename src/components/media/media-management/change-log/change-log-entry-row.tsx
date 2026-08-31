"use client";
import { ReactNode, useState, useTransition } from "react";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { deleteChangeLogEntry } from "./change-log-actions";
import styles from "./change-log-list.module.sass";

type Props = {
	id: number;
	initialDeletedAt: Date | null;
	children: ReactNode;
	// Driven by ChangeLogList's index (not CSS :nth-child) since interleaved timeline dividers would throw off odd/even.
	alt: boolean;
};

// Row content stays server-rendered (children pre-built by ChangeLogList); this wrapper just owns
// the delete button and greyed-out state so a click doesn't need a full page refetch.
export function ChangeLogEntryRow({ id, initialDeletedAt, children, alt }: Props) {
	const [deletedAt, setDeletedAt] = useState(initialDeletedAt);
	const [isPending, startTransition] = useTransition();
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;

	function handleDelete() {
		startTransition(async () => {
			await deleteChangeLogEntry(id);
			setDeletedAt(new Date());
		});
	}

	// Soft-deleted entries stick around only so an admin can see what was removed before purge.
	if (deletedAt && !isAdmin) return null;

	return (
		<li
			className={`${styles.entry} ${alt ? styles.entry_alt : ""} ${deletedAt ? styles.entry_deleted : ""}`}
		>
			{children}
			{isAdmin &&
				(deletedAt ? (
					<span className={styles.deleted_label}>Deleted</span>
				) : (
					<button
						type="button"
						className={styles.delete_button}
						onClick={handleDelete}
						disabled={isPending}
						aria-label="Delete change log entry"
					>
						×
					</button>
				))}
		</li>
	);
}
