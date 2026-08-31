"use client";
import { ReactNode } from "react";
import { useIsAdmin } from "@/lib/use-is-admin";
import styles from "./change-log-list.module.sass";

type Props = {
	// Admin sees totalCount so a fully soft-deleted log doesn't render as empty for them too.
	totalCount: number;
	visibleCount: number;
	children: ReactNode;
};

export function ChangeLogEmptyGate({ totalCount, visibleCount, children }: Props) {
	const isAdmin = useIsAdmin();
	const count = isAdmin ? totalCount : visibleCount;

	if (count === 0) {
		return <div className={styles.empty}>No changes recorded yet.</div>;
	}

	return <>{children}</>;
}
