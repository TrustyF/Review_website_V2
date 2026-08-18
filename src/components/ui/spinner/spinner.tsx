import styles from "./spinner.module.sass";

// Neutral "something's loading" indicator for a route's loading.tsx — used
// instead of a skeleton that mimics the real layout, since a skeleton whose
// shape doesn't quite match the real content (spacing, card sizes, ...) reads
// as more jarring once the swap happens than a plain spinner does.
export function Spinner() {
	return (
		<div className={styles.wrapper}>
			<div className={styles.spinner} />
		</div>
	);
}
