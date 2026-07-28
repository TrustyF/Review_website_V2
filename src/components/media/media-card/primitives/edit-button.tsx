"use client";
import styles from "./primitives.module.sass";

import { useReviewEditorStore } from "@/components/media/media-editor/review-editor-store";
import { useIsAdminStore } from "@/lib/is-admin-store";

export function MediaEditButton({ mediaId }: { mediaId: number }) {
	const open = useReviewEditorStore((s) => s.open);
	const editingMediaId = useReviewEditorStore((s) => s.mediaId);
	const isAdmin = useIsAdminStore((s) => s.isAdmin);

	if (!mediaId) return null;
	if (!isAdmin) return null;
	// This card is the editor's own preview of the media it's already
	// editing — showing an edit button there would just reopen itself.
	if (editingMediaId === mediaId) return null;

	return (
		<button
			className={styles.edit_button}
			onClick={() => open(mediaId)}
		>
			✏️
		</button>
	);
}
