"use client";
import { useEffect } from "react";
import { Link } from "@/components/ui/link";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./error-page.module.sass";

// Rendered inside the root layout, so the navbar and i18n context still work.
export default function ErrorPage({
	error,
	retry,
}: {
	error: unknown;
	retry: () => void;
}) {
	const dict = useDictionary();
	const digest =
		error instanceof Error && "digest" in error
			? String(error.digest)
			: undefined;

	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className={styles.wrapper}>
			<h1>{dict.errorPage.errorTitle}</h1>
			<p>{dict.errorPage.errorBody}</p>
			<div className={styles.actions}>
				<Clickable onClick={retry} className={styles.button}>
					{dict.errorPage.retry}
				</Clickable>
				<Link href="/" className={styles.button}>
					{dict.errorPage.home}
				</Link>
			</div>
			{digest && <div className={styles.digest}>{digest}</div>}
		</div>
	);
}
