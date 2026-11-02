"use client";
import { useEffect } from "react";
import "./styles/globals.sass";
import { fontVariables } from "./fonts";
import { Clickable } from "@/components/ui/clickable";
import styles from "./error-page.module.sass";

// Replaces the root layout, so no i18n context or navbar: English only.
export default function GlobalError({
	error,
	retry,
}: {
	error: unknown;
	retry: () => void;
}) {
	const digest =
		error instanceof Error && "digest" in error
			? String(error.digest)
			: undefined;

	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<html lang="en" className={fontVariables}>
			<body>
				<title>Something went wrong</title>
				<div className={styles.wrapper}>
					<h1>Something went wrong</h1>
					<p>The site hit an unexpected error. Try again in a moment.</p>
					<div className={styles.actions}>
						<Clickable onClick={retry} className={styles.button}>
							Try again
						</Clickable>
						{/* Plain <a>: a full reload is the point when the root layout failed. */}
						{/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
						<a href="/" className={styles.button}>
							Home
						</a>
					</div>
					{digest && <div className={styles.digest}>{digest}</div>}
				</div>
			</body>
		</html>
	);
}
