"use client";
import { ReactNode } from "react";
import { useIsAdminStore } from "@/lib/is-admin-store";
import styles from "./change-log-list.module.sass";

type Props = {
	// Every entry, vs. only the ones a non-admin actually gets to see (see
	// change-log-entry-row.tsx) — an admin can have a non-empty log that's
	// entirely soft-deleted, which would otherwise render as a silently
	// empty <ul> for everyone else.
	totalCount: number;
	visibleCount: number;
	children: ReactNode;
};

export function ChangeLogEmptyGate({ totalCount, visibleCount, children }: Props) {
	const isAdmin = useIsAdminStore((s) => s.isAdmin);
	const count = isAdmin ? totalCount : visibleCount;

	if (count === 0) {
		return <div className={styles.empty}>No changes recorded yet.</div>;
	}

	return <>{children}</>;
}
