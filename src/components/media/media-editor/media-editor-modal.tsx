"use client";
import styles from "./media-editor-modal.module.sass";
import { useReviewEditorStore } from "./review-editor-store";
import { MediaRecord } from "@/components/media/media-card/types";
import { useEffect, useState } from "react";
import {
	getMediaForEdit,
	saveReview,
} from "@/components/media/media-editor/media-editor-actions";
import { MediaCardResolver } from "@/components/media/media-card/media-card-resolver";
import { Review } from "@prisma/client";

export default function MediaEditorModal() {
	const mediaId = useReviewEditorStore((s) => s.mediaId);
	const close = useReviewEditorStore((s) => s.close);

	// Editable copy of the fetched record (poster already resolved). Every
	// field edit patches this directly, and the preview renders it as-is.
	const [draft, setDraft] = useState<MediaRecord | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Fetch the record whenever a media id is selected
	useEffect(() => {
		if (mediaId === null) return;
		getMediaForEdit(mediaId).then((media) => {
			setDraft(media);
			setSaveError(null);
		});
	}, [mediaId]);

	if (mediaId === null) return null;

	async function handleSave() {
		if (!draft) return;
		setIsSaving(true);
		setSaveError(null);
		try {
			await saveReview(draft.id, {
				rating: draft.review?.rating ?? null,
				liked: draft.review?.liked ?? false,
				difficulty: draft.review?.difficulty ?? 0,
				body: draft.review?.body ?? null,
			});
			close();
		} catch {
			setSaveError("Failed to save. Try again.");
		} finally {
			setIsSaving(false);
		}
	}

	// Generic patch helper for the review sub-record: fills in defaults for
	// any fields not yet edited, then applies the given patch on top.
	function patchReview(patch: Partial<Review>) {
		setDraft((prev) => {
			if (!prev) return prev;
			const review: Review = {
				id: prev.review?.id ?? 0,
				mediaId: prev.id,
				rating: prev.review?.rating ?? null,
				liked: prev.review?.liked ?? false,
				difficulty: prev.review?.difficulty ?? 0,
				body: prev.review?.body ?? null,
				createDate: prev.review?.createDate ?? new Date(),
				updateDate: prev.review?.updateDate ?? null,
				...patch,
			};
			return { ...prev, review };
		});
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.media_preview}>
				{draft && <MediaCardResolver media={draft} />}
			</div>

			<div className={styles.fields}>
				{/* Quick stats: short, single-value fields grouped in a row */}
				<div className={styles.quick_stats}>
					<label className={styles.field}>
						Rating
						<input
							type="number"
							min={0}
							max={10}
							step={0.5}
							value={draft?.review?.rating ?? ""}
							onChange={(e) =>
								patchReview({
									rating: e.target.value === "" ? null : Number(e.target.value),
								})
							}
						/>
					</label>
					<label className={styles.field}>
						Liked
						<input
							type="checkbox"
							checked={draft?.review?.liked ?? false}
							onChange={(e) => patchReview({ liked: e.target.checked })}
						/>
					</label>
					<label className={styles.field}>
						Difficulty
						<input
							type="number"
							min={0}
							max={2}
							step={1}
							value={draft?.review?.difficulty ?? 0}
							onChange={(e) =>
								patchReview({ difficulty: Number(e.target.value) })
							}
						/>
					</label>
				</div>

				{/* Review body: long-form field, kept on its own row */}
				<label className={styles.field}>
					Body
					<textarea
						value={draft?.review?.body ?? ""}
						onChange={(e) => patchReview({ body: e.target.value })}
						rows={6}
					/>
				</label>
			</div>

			{saveError && <div className={styles.save_error}>{saveError}</div>}
			<div className={styles.actions}>
				<button
					onClick={handleSave}
					disabled={isSaving}
				>
					{isSaving ? "Saving…" : "Save"}
				</button>
				<button onClick={close}>Close</button>
			</div>
		</div>
	);
}
