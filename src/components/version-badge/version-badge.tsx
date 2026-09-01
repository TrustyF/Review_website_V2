"use client";
import { useIsAdmin } from "@/lib/use-is-admin";
import styles from "./version-badge.module.sass";

// Temporary deploy-verification aid — remove once the self-hosting rollout
// is confirmed stable. NEXT_PUBLIC_BUILD_TIME is inlined at build time (see
// package.json's build script), so it changes only when a new image is
// actually built, not on every request.
export function VersionBadge() {
	const isAdmin = useIsAdmin();
	if (!isAdmin) return null;

	const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME ?? "dev";

	return <div className={styles.badge}>build: {buildTime}</div>;
}
