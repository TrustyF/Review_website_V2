import styles from "./spinner.module.sass";

// Neutral loading indicator; skeleton mismatch reads more jarring than plain spinner.
export function Spinner() {
	return (
		<div className={styles.wrapper}>
			<div className={styles.spinner} />
		</div>
	);
}
