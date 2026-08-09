"use client";
import Link from "next/link";
import { useIsAdminStore } from "@/lib/is-admin-store";
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
// meant to work in production for an admin (Image crop) and the toggle
// that flips isAdmin itself. That toggle is deliberately gated on isDev,
// not isAdmin — gating it on isAdmin would mean switching admin off also
// hides the only way to switch it back on.
export function DevMenu() {
	const isAdmin = useIsAdminStore((s) => s.isAdmin);
	const toggleAdmin = useIsAdminStore((s) => s.toggleAdmin);

	if (!isDev && !isAdmin) return null;

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
				{(isDev || isAdmin) && (
					<div className={styles.section}>
						<div className={styles.section_title}>Tools</div>
						{isAdmin && (
							<Link href="/dev/image-crop" className={styles.link}>
								Image crop
							</Link>
						)}
						{/* Temporary — preview the site as a non-admin visitor without
						    editing code. See is-admin-store.ts's own note on why this
						    (and toggleAdmin) should come out once real auth exists. */}
						{isDev && (
							<button
								type="button"
								className={styles.admin_toggle}
								onClick={toggleAdmin}>
								Admin: {isAdmin ? "ON" : "OFF"}
							</button>
						)}
					</div>
				)}
			</div>
		</details>
	);
}
