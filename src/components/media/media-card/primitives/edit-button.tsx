"use client";
import styles from "./primitives.module.sass";

import { useReviewEditorStore } from "@/components/media/media-editor/review-editor-store";

export function MediaEditButton({ mediaId }: { mediaId: number }) {
	const open = useReviewEditorStore((s) => s.open);

	if (!mediaId) return null;

	return (
		<button
			className={styles.edit_button}
			onClick={() => open(mediaId)}
		>
			✏️
		</button>
	);
}
