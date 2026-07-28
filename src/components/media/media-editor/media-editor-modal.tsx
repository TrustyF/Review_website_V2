"use client";
import styles from "./media-editor-modal.module.sass";
import { useReviewEditorStore } from "./review-editor-store";
import { MediaRecord } from "@/components/media/media-card/types";
import { useEffect, useState } from "react";
import { getMediaForEdit } from "@/components/media/media-editor/media-editor-actions";
import { MediaCardResolver } from "@/components/media/media-card/media-card-resolver";

export default function MediaEditorModal() {
	const mediaId = useReviewEditorStore((s) => s.mediaId);
	const close = useReviewEditorStore((s) => s.close);

	const [media, setMedia] = useState<MediaRecord | null>(null);
	const [posterSrc, setPosterSrc] = useState<string | null>(null);

	useEffect(() => {
		if (mediaId === null) return;
		getMediaForEdit(mediaId).then(({ media, posterSrc }) => {
			setMedia(media);
			setPosterSrc(posterSrc);
		});
	}, [mediaId]);

	if (mediaId === null) return null;

	return (
		<div className={styles.wrapper}>
			<div className={styles.media_preview}>
				{media && posterSrc && (
					<MediaCardResolver
						media={media}
						posterSrc={posterSrc}
						showEditButton={false}
					/>
				)}
			</div>
			<button onClick={close}>Close</button>
		</div>
	);
}
