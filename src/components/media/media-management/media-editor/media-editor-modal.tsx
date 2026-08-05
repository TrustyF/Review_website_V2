"use client";
import styles from "./media-editor-modal.module.sass";
import { useReviewEditorStore } from "./review-editor-store";
import { MediaRecord } from "@/components/media/types";
import { useEffect, useState } from "react";
import {
	saveMediaDetails,
	saveReview,
	updateMediaPoster,
} from "@/components/media/media-management/media-editor/media-editor-actions";
import { MediaCardResolver } from "@/components/media/media-cards/media-card/media-card-resolver";
import { PosterPicker } from "@/components/media/media-management/media-editor/components/poster-picker";
import { ReviewBodyModal } from "@/components/media/media-management/media-editor/components/review-body-modal";
import { StarIcon } from "@/components/media/icons/star-icon";
import { MediaType, Review } from "@prisma/client";

// Every type has some way to browse alternative posters — TMDB (movies/TV)
// and MangaDex (manga) both expose more than one cover per title directly.
// ComicVine has no alternates at the volume level, but its issues' own
// covers stand in for them. IGDB's game object itself only ever has one
// cover, but its region-specific box art (game_localizations) fills the
// same role — see fetchIgdbGameCoverOptions.
const POSTER_PICKER_TYPES: MediaType[] = [
	MediaType.MOVIE,
	MediaType.SHORT,
	MediaType.TVSHOW,
	MediaType.MANGA,
	MediaType.COMIC,
	MediaType.GAME,
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

	// A manually pasted poster URL (for media with no picker, or no provider
	// at all). Kept separate from the picker's preview: a pasted URL can be
	// any host, and feeding an unproxied, un-allowlisted host straight into
	// next/image throws, so this gets a plain <img> preview of its own
	// instead of updating draft.posterSrc — the real preview only picks it
	// up once it's saved and downloaded through resolvePoster like any
	// other source.
	const [posterUrlInput, setPosterUrlInput] = useState("");

	// Body editing (textarea + AI suggestion diff) lives in its own modal —
	// see ReviewBodyModal — so it gets enough room to lay out side by side.
	const [isBodyModalOpen, setIsBodyModalOpen] = useState(false);

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
		setIsBodyModalOpen(false);
		setPosterUrlInput("");
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

	function applyPosterUrl() {
		const url = posterUrlInput.trim();
		if (!url) return;
		setPendingPosterPath(url);
	}

	// MediaEditorModal stays mounted permanently (see layout.tsx) and just
	// renders null while closed, so its state isn't reset by unmounting —
	// without this, a picked-but-unsaved poster could still show as pending
	// next time it's shown.
	function handleClose() {
		setPendingPosterPath(null);
		setIsBodyModalOpen(false);
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
				saveMediaDetails(draft.id, {
					title: draft.title,
					overview: draft.overview,
					releaseDate: draft.releaseDate
						? draft.releaseDate.toISOString().slice(0, 10)
						: null,
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

	// Generic patch helper for the base Media fields — the ones a provider's
	// ingest normally owns, editable here for media with no provider match
	// (or a wrong one) at all.
	function patchDetails(patch: {
		title?: string;
		overview?: string | null;
		releaseDate?: Date | null;
	}) {
		setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.wrapper_body}>
				<div className={styles.media_preview}>
					{draft && <MediaCardResolver media={draft} />}
				</div>
				<span className={styles.divider} />

				{/* Base Media fields — normally owned entirely by a source's
				ingest, editable here for the rare case a provider has no match
				(or the wrong match) for this title at all. */}
				<div className={styles.details_group}>
					<label className={styles.field}>
						Title
						<input
							type="text"
							className={styles.field_input_wide}
							value={draft?.title ?? ""}
							onChange={(e) => patchDetails({ title: e.target.value })}
						/>
					</label>
					<label className={styles.field}>
						Overview
						<textarea
							className={styles.field_textarea}
							value={draft?.overview ?? ""}
							onChange={(e) =>
								patchDetails({ overview: e.target.value || null })
							}
						/>
					</label>
					<div className={styles.details_row}>
						<label className={styles.field}>
							Release date
							<input
								type="date"
								className={styles.field_input}
								value={
									draft?.releaseDate
										? new Date(draft.releaseDate).toISOString().slice(0, 10)
										: ""
								}
								onChange={(e) =>
									patchDetails({
										releaseDate: e.target.value
											? new Date(e.target.value)
											: null,
									})
								}
							/>
						</label>
						<label className={styles.field}>
							Poster URL
							<div className={styles.poster_url_row}>
								<input
									type="text"
									className={styles.field_input_wide}
									placeholder="https://…"
									value={posterUrlInput}
									onChange={(e) => setPosterUrlInput(e.target.value)}
								/>
								<button
									type="button"
									onClick={applyPosterUrl}
								>
									Use
								</button>
							</div>
							{posterUrlInput.trim() && (
								// Plain <img>, deliberately not next/image: a pasted URL
								// can be any host, and only gets proxied/cached once it's
								// actually saved (see resolvePoster) — this is just a
								// best-effort look at what you're about to set.
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={posterUrlInput.trim()}
									alt=""
									className={styles.poster_url_preview}
								/>
							)}
							{pendingPosterPath === posterUrlInput.trim() &&
								posterUrlInput.trim() && (
									<span className={styles.poster_url_applied}>
										Will apply on save
									</span>
								)}
						</label>
					</div>
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

					{/* Review body: preview + edit button, kept on its own row.
					Actual editing (and the AI suggestion diff) happens in
					ReviewBodyModal, which has room to lay them out side by side. */}
					<div className={styles.body_group}>
						<label className={styles.field}>
							Body
							<div className={styles.body_preview}>
								{draft?.review?.body || <em>No review text yet.</em>}
							</div>
						</label>

						<button
							type="button"
							onClick={() => setIsBodyModalOpen(true)}
						>
							Edit body
						</button>
					</div>

					{draft && POSTER_PICKER_TYPES.includes(draft.type) && (
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

			{isBodyModalOpen && draft && (
				<ReviewBodyModal
					body={draft.review?.body ?? ""}
					onChange={(body) => patchReview({ body })}
					onClose={() => setIsBodyModalOpen(false)}
				/>
			)}
		</div>
	);
}
