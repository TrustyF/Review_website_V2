import styles from "./primitives.module.sass";

export function MediaReleaseDate({ date }: { date: Date | null }) {
	if (!date) return null;
	return <div className={styles.release_date}>{date.getFullYear()}</div>;
}

// Same formatter/wording as review-body-edit-trigger.tsx's own upcoming-release placeholder.
const FullReleaseDateFormatter = new Intl.DateTimeFormat("en-GB", {
	month: "long",
	day: "numeric",
});

export function formatReleaseDate(date: Date | null): string | null {
	if (!date) return null;
	return FullReleaseDateFormatter.format(date);
}
