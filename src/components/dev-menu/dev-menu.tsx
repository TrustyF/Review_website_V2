"use client";
import { useTransition } from "react";
import { Link } from "@/components/ui/link";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { forceRevalidateAll } from "./dev-menu-actions";
import styles from "./dev-menu.module.sass";

const isDev = process.env.NODE_ENV === "development";

// Fixed-to-viewport sibling in root layout, not nested (nav's transform would contain it).
// Dev routes dev-only; Tools work in production for admins.
export function DevMenu() {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported (see nav-admin-links.tsx
	// for the same rule applied to the navbar's own admin links).
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const [isPending, startTransition] = useTransition();

	if (!isAdmin) return null;

	return (
		<details className={styles.wrapper}>
			<summary className={styles.button} aria-label="Dev menu">
				⚙
			</summary>
			<div className={styles.panel}>
				{isDev && (
					<div className={styles.section}>
						<div className={styles.section_title}>Dev routes</div>
						<Link href="/dev/gauges" className={styles.link}>
							Gauges
						</Link>
						<Link href="/dev/banner-compression" className={styles.link}>
							Banner compression
						</Link>
						<Link href="/dev/logo" className={styles.link}>
							Logo
						</Link>
						<Link href="/dev/invocations" className={styles.link}>
							Invocations
						</Link>
						<Link href="/dev/responsive-preview" className={styles.link}>
							Responsive preview
						</Link>
						<Link href="/dev/link-embed-preview" className={styles.link}>
							Link embed preview
						</Link>
					</div>
				)}
				{isAdmin && (
					<div className={styles.section}>
						<div className={styles.section_title}>Tools</div>
						<button
							type="button"
							className={styles.tool_button}
							disabled={isPending}
							// Manual refresh after DB edit; not substitute for server actions' revalidatePath
							onClick={() => startTransition(() => forceRevalidateAll())}>
							{isPending ? "Refreshing…" : "Force DB refresh"}
						</button>
					</div>
				)}
			</div>
		</details>
	);
}
