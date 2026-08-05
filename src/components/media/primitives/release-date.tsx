import styles from "./primitives.module.sass";

export function MediaReleaseDate({ date }: { date: Date | null }) {
	if (!date) return null;
	return <div className={styles.release_date}>{date.getFullYear()}</div>;
}
