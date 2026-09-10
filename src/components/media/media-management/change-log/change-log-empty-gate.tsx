"use client";
import { ReactNode } from "react";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./change-log-list.module.sass";

type Props = {
	// Admin sees totalCount so a fully soft-deleted log doesn't render as empty for them too.
	totalCount: number;
	visibleCount: number;
	children: ReactNode;
};

export function ChangeLogEmptyGate({ totalCount, visibleCount, children }: Props) {
	const dict = useDictionary();
	const isAdmin = useIsAdmin();
	const count = isAdmin ? totalCount : visibleCount;

	if (count === 0) {
		return <div className={styles.empty}>{dict.changeLog.empty}</div>;
	}

	return <>{children}</>;
}
