"use client";
import styles from "./media-editor-modal.module.sass";
import { useReviewEditorStore } from "./review-editor-store";
import { MediaRecord } from "@/components/media/media-card/types";
import { useEffect, useState } from "react";
import {
	getAlternativePosters,
	getMediaForEdit,
	saveReview,
	updateMediaPoster,
} from "@/components/media/media-editor/media-editor-actions";
import { MediaCardResolver } from "@/components/media/media-card/media-card-resolver";
import { MediaType, Review } from "@prisma/client";

// Only these types are sourced from TMDB, so only they have alternative
// posters to pick from.
const TMDB_TYPES: MediaType[] = [
	MediaType.MOVIE,
	MediaType.SHORT,
	MediaType.TVSHOW,
];

export default function MediaEditorModal() {
	const mediaId = useReviewEditorStore((s) => s.mediaId);
	const close = useReviewEditorStore((s) => s.close);

	// Editable copy of the fetched record (poster already resolved). Every
	// field edit patches this directly, and the preview renders it as-is.
	const [draft, setDraft] = useState<MediaRecord | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Alternative poster picker: fetched from TMDB on demand, since it's an
	// extra API call we don't want on every editor open.
	const [posterOptions, setPosterOptions] = useState<
		| {
				filePath: string;
				width: number;
				height: number;
				thumbSrc: string;
				previewSrc: string;
		  }[]
		| null
	>(null);
	// Picked but not yet saved — applied to Media.posterPath on save, so you
	// can try a few candidates against the preview before committing to one.
	const [pendingPosterPath, setPendingPosterPath] = useState<string | null>(
		null,
	);

	// Fetch the record whenever a media id is selected
	useEffect(() => {
		if (mediaId === null) return;
		getMediaForEdit(mediaId).then((media) => {
			setDraft(media);
			setSaveError(null);
			setPosterOptions(null);
			setPendingPosterPath(null);
		});
	}, [mediaId]);

	// The modal itself scrolls internally (its content can exceed viewport
	// height), so the background page's own scroll is locked while it's open
	// to avoid the two competing for the same gesture. With this page's CSS
	// (body has min-height, not height), the document's actual scrolling
	// element is <html>, not <body> — locking body alone does nothing, so
	// both need it.
	useEffect(() => {
		if (mediaId === null) return;
		const html = document.documentElement;
		const previousHtmlOverflow = html.style.overflow;
		const previousBodyOverflow = document.body.style.overflow;
		html.style.overflow = "hidden";
		document.body.style.overflow = "hidden";
		return () => {
			html.style.overflow = previousHtmlOverflow;
			document.body.style.overflow = previousBodyOverflow;
		};
	}, [mediaId]);

	if (mediaId === null) return null;

	async function openPosterPicker() {
		if (!draft) return;
		setPosterOptions(await getAlternativePosters(draft.externalId, draft.type));
	}

	// Just swaps in the proxied preview URL — no download, no DB write, so
	// trying a poster and changing your mind costs nothing. Media.posterPath
	// only gets touched (and the poster only gets downloaded/cached) on save.
	// The picker stays open so you can try a few in a row.
	function pickPoster(poster: { filePath: string; previewSrc: string }) {
		setPendingPosterPath(poster.filePath);
		setDraft((prev) =>
			prev ? { ...prev, posterSrc: poster.previewSrc } : prev,
		);
	}

	// MediaEditorModal stays mounted permanently (see layout.tsx) and just
	// renders null while closed, so its state isn't reset by unmounting —
	// without this, the picker could still be open the next time it's shown.
	function resetPosterPicker() {
		setPosterOptions(null);
		setPendingPosterPath(null);
	}

	function handleClose() {
		resetPosterPicker();
		close();
	}

	async function handleSave() {
		if (!draft) return;
		setIsSaving(true);
		setSaveError(null);
		try {
			await Promise.all([
				saveReview(draft.id, {
					rating: draft.review?.rating ?? null,
					liked: draft.review?.liked ?? false,
					difficulty: draft.review?.difficulty ?? 0,
					body: draft.review?.body ?? null,
				}),
				pendingPosterPath
					? updateMediaPoster(draft.id, pendingPosterPath)
					: Promise.resolve(),
			]);
			resetPosterPicker();
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
				<label className={`${styles.field}`}>
					Body
					<textarea
						className={styles.body}
						value={draft?.review?.body ?? ""}
						onChange={(e) => patchReview({ body: e.target.value })}
						rows={6}
					/>
				</label>
			</div>

			{draft && TMDB_TYPES.includes(draft.type) && (
				<div className={styles.poster_picker}>
					<button onClick={openPosterPicker}>Change poster</button>
					{pendingPosterPath && (
						<div className={styles.poster_pending}>
							New poster selected — will apply when you save.
						</div>
					)}
					{posterOptions && (
						<div className={styles.poster_options}>
							{posterOptions.map((poster) => (
								<img
									key={poster.filePath}
									src={poster.thumbSrc}
									alt="Alternative poster option"
									className={styles.poster_option}
									onClick={() => pickPoster(poster)}
								/>
							))}
						</div>
					)}
				</div>
			)}

			{saveError && <div className={styles.save_error}>{saveError}</div>}
			<div className={styles.actions}>
				<button
					onClick={handleSave}
					disabled={isSaving}
				>
					{isSaving ? "Saving…" : "Save"}
				</button>
				<button onClick={handleClose}>Close</button>
			</div>
		</div>
	);
}
