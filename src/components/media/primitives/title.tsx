"use client";
import { useLocale } from "@/lib/i18n/i18n-context";
import styles from "./primitives.module.sass";

export function MediaTitle({
	title,
	titleFr,
	className,
}: {
	title: string;
	// Falls back to English when no French title has been ingested — see
	// Media.titleFr and Review.bodyFr's identical fallback in review.tsx.
	titleFr?: string | null;
	className?: string | undefined;
}) {
	const locale = useLocale();
	const text = locale === "fr" ? (titleFr ?? title) : title;
	if (!text) return null;
	return (
		<div
			className={[styles.title, className].filter(Boolean).join(" ")}
			title={text}
		>
			{text}
		</div>
	);
}
