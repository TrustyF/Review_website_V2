import styles from "./primitives.module.sass";

export function MediaTitle({ title }: { title: string }) {
	if (!title) return null;
	return <div className={styles.title}>{title}</div>;
}
