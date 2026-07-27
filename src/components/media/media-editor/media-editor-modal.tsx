import styles from "./media-editor-modal.module.sass";

export default async function MediaEditorModal() {
	return (
		<div className={styles.wrapper}>
			<div className={styles.media_preview}></div>
		</div>
	);
}
