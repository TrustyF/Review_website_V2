"use client";
import Link from "next/link";
import { useIsAdmin } from "@/lib/use-is-admin";
import styles from "./new-list-link.module.sass";

export function NewListLink() {
	const isAdmin = useIsAdmin();
	if (!isAdmin) return null;

	return (
		<Link href="/lists/new" className={styles.new_link}>
			New list
		</Link>
	);
}
