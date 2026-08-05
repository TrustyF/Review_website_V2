import styles from "./primitives.module.sass";

export function formatRuntime(runtime: number | null) {
	if (!runtime) return null;
	if (runtime < 60) return `${runtime}m`;

	const hours = String(Math.floor(runtime / 60));
	const minutes = String(runtime % 60).padStart(2, "0");

	return `${hours}h${minutes}`;
}

export function MediaRuntime({ runtime }: { runtime: number | null }) {
	const formatted = formatRuntime(runtime);
	if (!formatted) return null;
	return <div className={styles.info_line}>{formatted}</div>;
}
