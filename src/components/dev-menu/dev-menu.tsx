"use client";
import Link from "next/link";
import { useIsAdmin } from "@/lib/use-is-admin";
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
// meant to work in production for an admin (Image crop).
export function DevMenu() {
	const isAdmin = useIsAdmin();

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
				{isAdmin && (
					<div className={styles.section}>
						<div className={styles.section_title}>Tools</div>
						<Link href="/dev/image-crop" className={styles.link}>
							Image crop
						</Link>
					</div>
				)}
			</div>
		</details>
	);
}
