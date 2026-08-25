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
	// Alternating-row background — driven by ChangeLogList's own index into
	// the entry list (not CSS :nth-child) since timeline gap dividers are
	// interleaved <li>s too, and would throw off a purely structural
	// odd/even count.
	alt: boolean;
};

// The row itself stays server-rendered (children come pre-built from
// ChangeLogList, including the posterPath thumbnail — that needs
// Buffer-based helpers that only run server-side) — this wrapper just owns
// the delete button and the greyed-out state, so clicking it doesn't need a
// full page refetch to show.
export function ChangeLogEntryRow({ id, initialDeletedAt, children, alt }: Props) {
	const [deletedAt, setDeletedAt] = useState(initialDeletedAt);
	const [isPending, startTransition] = useTransition();
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported (see nav-admin-links.tsx
	// for the same rule applied to the navbar's own admin links).
	const isAdmin = sessionIsAdmin && !isMobileViewport;

	function handleDelete() {
		startTransition(async () => {
			await deleteChangeLogEntry(id);
			setDeletedAt(new Date());
		});
	}

	// Soft-deleted entries stick around (see change-log-actions.ts) only so
	// an admin can see what was removed before the maintenance purge — to
	// everyone else the log should read as if they were never there.
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
