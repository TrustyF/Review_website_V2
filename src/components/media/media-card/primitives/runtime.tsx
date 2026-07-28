import styles from "./primitives.module.sass";

function formatMinutes(runtime: number) {
	if (runtime < 60) return `${runtime}m`;

	const hours = String(Math.floor(runtime / 60));
	const minutes = String(runtime % 60).padStart(2, "0");

	return `${hours}h${minutes}`;
}
export function MediaRuntime({ runtime }: { runtime: number | null }) {
	if (!runtime) return null;
	return <div className={styles.runtime}>{formatMinutes(runtime)}</div>;
}
