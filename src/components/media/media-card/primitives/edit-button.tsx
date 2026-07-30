"use client";
import styles from "./primitives.module.sass";

import { useReviewEditorStore } from "@/components/media/media-editor/review-editor-store";
import { useIsAdminStore } from "@/lib/is-admin-store";
import { MediaRecord } from "@/components/media/media-card/types";
import { PenIcon } from "@/components/media/icons/pen-icon";

export function MediaEditButton({ media }: { media: MediaRecord }) {
	const open = useReviewEditorStore((s) => s.open);
	const editingMediaId = useReviewEditorStore((s) => s.media?.id ?? null);
	const isAdmin = useIsAdminStore((s) => s.isAdmin);

	if (!media.id) return null;
	if (!isAdmin) return null;
	// This card is the editor's own preview of the media it's already
	// editing — showing an edit button there would just reopen itself.
	if (editingMediaId === media.id) return null;

	return (
		<div
			className={styles.edit_button}
			onClick={() => open(media)}
		>
			<PenIcon className={styles.pen_icon} />
		</div>
	);
}
