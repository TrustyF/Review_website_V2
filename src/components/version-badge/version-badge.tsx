"use client";
import { useIsAdmin } from "@/lib/use-is-admin";
import styles from "./version-badge.module.sass";

// Temporary deploy-verification aid; remove once self-hosting rollout is stable
export function VersionBadge() {
	const isAdmin = useIsAdmin();
	if (!isAdmin) return null;

	const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME ?? "dev";

	return <div className={styles.badge}>build: {buildTime}</div>;
}
