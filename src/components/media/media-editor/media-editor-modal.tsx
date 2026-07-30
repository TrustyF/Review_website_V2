"use client";
import styles from "./media-editor-modal.module.sass";
import { useReviewEditorStore } from "./review-editor-store";
import { MediaRecord } from "@/components/media/media-card/types";
import { useEffect, useState } from "react";
import {
	saveReview,
	updateMediaPoster,
} from "@/components/media/media-editor/media-editor-actions";
import { MediaCardResolver } from "@/components/media/media-card/cards/media-card-resolver";
import { PosterPicker } from "@/components/media/media-editor/components/poster-picker";
import { StarIcon } from "@/components/media/icons/star-icon";
import { MediaType, Review } from "@prisma/client";

// Only these types are sourced from TMDB, so only they have alternative
// posters to pick from.
const TMDB_TYPES: MediaType[] = [
	MediaType.MOVIE,
	MediaType.SHORT,
	MediaType.TVSHOW,
];

export default function MediaEditorModal() {
	const media = useReviewEditorStore((s) => s.media);
	const close = useReviewEditorStore((s) => s.close);
	const mediaId = media?.id ?? null;

	// Editable copy of the fetched record (poster already resolved). Every
	// field edit patches this directly, and the preview renders it as-is.
	const [draft, setDraft] = useState<MediaRecord | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Picked but not yet saved — applied to Media.posterPath on save, so you
	// can try a few candidates against the preview before committing to one.
	const [pendingPosterPath, setPendingPosterPath] = useState<string | null>(
		null,
	);

	// Reseed the draft the moment a new record shows up in the store (i.e. a
	// new editor session started) — done during render, not an effect, so
	// there's no extra commit where the preview would flash empty before
	// popping in. Track which record draft was seeded from (rather than just
	// mediaId) since the store always hands us a fresh object on open.
	const [draftSource, setDraftSource] = useState<MediaRecord | null>(null);
	if (media !== null && media !== draftSource) {
		setDraft(media);
		setDraftSource(media);
		setSaveError(null);
		setPendingPosterPath(null);
	}

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
	// without this, a picked-but-unsaved poster could still show as pending
	// next time it's shown.
	function handleClose() {
		setPendingPosterPath(null);
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
			setPendingPosterPath(null);
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
			<div className={styles.wrapper_body}>
				<div className={styles.media_preview}>
					{draft && <MediaCardResolver media={draft} />}
				</div>
				<span className={styles.divider} />

				<div className={styles.review_fields}>
					{/* Quick stats: short, single-value fields grouped in a row */}
					<div className={styles.quick_review}>
						<label className={styles.field}>
							Rating
							<div className={styles.rating_group}>
								<input
									type="number"
									min={0}
									max={10}
									step={0.5}
									className={styles.field_input}
									value={draft?.review?.rating ?? ""}
									onChange={(e) =>
										patchReview({
											rating:
												e.target.value === "" ? null : Number(e.target.value),
										})
									}
								/>
								<StarIcon className={styles.rating_star} />
							</div>
						</label>
						<label className={styles.field}>
							Liked
							<input
								type="checkbox"
								className={styles.field_checkbox}
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
								className={styles.field_input}
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

					{draft && TMDB_TYPES.includes(draft.type) && (
						<PosterPicker
							key={draft.id}
							draft={draft}
							onPick={pickPoster}
						/>
					)}
				</div>

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
		</div>
	);
}
