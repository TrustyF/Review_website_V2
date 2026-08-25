"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { forceRevalidateAll } from "./dev-menu-actions";
import styles from "./dev-menu.module.sass";

const isDev = process.env.NODE_ENV === "development";

// Floating, fixed-to-viewport button — rendered as a sibling of Navbar in
// the root layout, not nested inside it: nav-bar.module.sass's .wrapper
// gets a `transform` (the scroll-hide animation) on its .hidden state, and
// a transformed ancestor becomes the containing block for any descendant
// position: fixed element, which would silently reposition this against
// the navbar instead of the viewport whenever it auto-hides on scroll.
//
// Two sections, gated independently rather than as a single dev-only block
// — "Dev routes" is genuinely dev-only (the actual /dev/* pages besides
// image-crop 404 outside development), but "Tools" also holds things
// meant to work in production for an admin (Image crop). The menu itself
// is admin-only regardless of environment — running in development isn't
// on its own a reason to expose it to a signed-out or non-admin visitor.
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
						<Link href="/dev/media-cards" className={styles.link}>
							Media cards
						</Link>
						<Link href="/dev/gauges" className={styles.link}>
							Gauges
						</Link>
						<Link href="/dev/banner-compression" className={styles.link}>
							Banner compression
						</Link>
					</div>
				)}
				{isAdmin && (
					<div className={styles.section}>
						<div className={styles.section_title}>Tools</div>
						<Link href="/dev/image-crop" className={styles.link}>
							Image crop
						</Link>
						<button
							type="button"
							className={styles.tool_button}
							disabled={isPending}
							// After a manual DB edit, not a substitute for the
							// server actions' own revalidatePath calls — see
							// dev-menu-actions.ts.
							onClick={() => startTransition(() => forceRevalidateAll())}>
							{isPending ? "Refreshing…" : "Force DB refresh"}
						</button>
					</div>
				)}
			</div>
		</details>
	);
}
