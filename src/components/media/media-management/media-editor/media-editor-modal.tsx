"use client";
import styles from "./media-editor-modal.module.sass";
import { useReviewEditorStore } from "./review-editor-store";
import { MediaRecord } from "@/components/media/types";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
	finalizeMediaEditorSave,
	hardDeleteMedia,
	logRewatch,
	saveMediaDetails,
	saveReview,
	setMediaDeleted,
	updateMediaBanner,
	updateMediaPoster,
} from "@/components/media/media-management/media-editor/media-editor-actions";
import { ReviewBodyModal } from "@/components/media/media-management/media-editor/components/review-body-modal";
import { StarIcon } from "@/components/media/icons/star-icon";
import { Review } from "@prisma/client";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { EnrichedAgo } from "@/components/media/primitives/enriched-ago";

export default function MediaEditorModal() {
	const media = useReviewEditorStore((s) => s.media);
	const close = useReviewEditorStore((s) => s.close);
	const mediaId = media?.id ?? null;
	const router = useRouter();

	// Editable copy of the fetched record; every field edit patches this directly.
	const [draft, setDraft] = useState<MediaRecord | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Soft delete (toggle) / hard delete (irreversible), in the danger zone below —
	// separate from isSaving/saveError since either can run without touching the draft.
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	// Logging a rewatch is its own independent action — doesn't touch or wait on
	// unsaved draft edits, so it gets its own request state instead of riding handleSave.
	const [isLoggingRewatch, setIsLoggingRewatch] = useState(false);
	const [rewatchLogged, setRewatchLogged] = useState(false);
	// Hard delete needs an explicit second click before it actually fires —
	// this just tracks whether that warning is currently showing.
	const [confirmHardDelete, setConfirmHardDelete] = useState(false);

	// Picked but not yet saved — applied to Media.posterPath on save, so you
	// can try a few candidates against the preview before committing to one.
	const [pendingPosterPath, setPendingPosterPath] = useState<string | null>(
		null,
	);
	// Same idea as pendingPosterPath, for Media.bannerPath.
	const [pendingBannerPath, setPendingBannerPath] = useState<string | null>(
		null,
	);

	// A manually pasted poster/banner URL (no picker/provider). An unproxied host would
	// throw in next/image, so it gets a plain <img> until saved through resolvePoster/resolveBanner.
	const [posterUrlInput, setPosterUrlInput] = useState("");
	const [bannerUrlInput, setBannerUrlInput] = useState("");

	// Body editing (textarea + AI suggestion diff) lives in its own modal —
	// see ReviewBodyModal — so it gets enough room to lay out side by side.
	const [isBodyModalOpen, setIsBodyModalOpen] = useState(false);

	// Reseed the draft the moment a new record shows up in the store — done during
	// render, not an effect, so the preview never flashes empty before popping in.
	const [draftSource, setDraftSource] = useState<MediaRecord | null>(null);
	if (media !== null && media !== draftSource) {
		setDraft(media);
		setDraftSource(media);
		setSaveError(null);
		setPendingPosterPath(null);
		setPendingBannerPath(null);
		setIsBodyModalOpen(false);
		setPosterUrlInput("");
		setBannerUrlInput("");
		setDeleteError(null);
		setConfirmHardDelete(false);
		setRewatchLogged(false);
	}

	// Locks the background page's scroll while the modal (which scrolls internally)
	// is open. Body has min-height not height, so <html> is the real scroller — both need it.
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

	// Just swaps in the preview URL — no download or DB write, so trying a
	// poster costs nothing. Media.posterPath is only touched on save.
	function applyPosterUrl() {
		const url = posterUrlInput.trim();
		if (!url) return;
		setPendingPosterPath(url);
	}

	function applyBannerUrl() {
		const url = bannerUrlInput.trim();
		if (!url) return;
		setPendingBannerPath(url);
	}

	// MediaEditorModal stays mounted permanently and just renders null while closed,
	// so state isn't reset by unmounting — without this, a stale pending poster would linger.
	function handleClose() {
		setPendingPosterPath(null);
		setPendingBannerPath(null);
		setIsBodyModalOpen(false);
		setDeleteError(null);
		setConfirmHardDelete(false);
		close();
	}

	// Toggles isDeleted both ways (button reads "Soft delete"/"Restore" accordingly).
	// Applies immediately rather than waiting for Save — nothing here to preview first.
	async function handleToggleDeleted() {
		if (!draft) return;
		setIsDeleting(true);
		setDeleteError(null);
		try {
			const nextIsDeleted = !draft.isDeleted;
			await setMediaDeleted(draft.id, nextIsDeleted);
			setDraft((prev) => (prev ? { ...prev, isDeleted: nextIsDeleted } : prev));
		} catch {
			setDeleteError("Failed to update. Try again.");
		} finally {
			setIsDeleting(false);
		}
	}

	// Only reachable after confirmHardDelete's second click. Sends the browser home
	// afterward, since the open page might be /media/[id] for the thing just deleted.
	async function handleHardDelete() {
		if (!draft) return;
		setIsDeleting(true);
		setDeleteError(null);
		try {
			await hardDeleteMedia(draft.id);
			close();
			router.push("/");
		} catch {
			setDeleteError("Failed to delete. Try again.");
			setIsDeleting(false);
		}
	}

	// Fires immediately on click, no draft/confirmation step — matches logRewatch's
	// one-click design. rewatchLogged is transient UI state, reset on reopen.
	async function handleLogRewatch() {
		if (!draft) return;
		setIsLoggingRewatch(true);
		try {
			await logRewatch(draft.id);
			setRewatchLogged(true);
		} finally {
			setIsLoggingRewatch(false);
		}
	}

	async function handleSave() {
		if (!draft) return;
		setIsSaving(true);
		setSaveError(null);
		try {
			await Promise.all([
				// draft.review stays unset until patchReview's first call, so this is
				// false for an untouched, never-rated media — saveReview itself rejects a null rating.

				// All four save with revalidate: false to avoid 4x ISR writes;
				// finalizeMediaEditorSave below does the one write that's actually needed.
				draft.review
					? saveReview(
							draft.id,
							{
								rating: draft.review.rating,
								liked: draft.review.liked,
								difficulty: draft.review.difficulty,
								body: draft.review.body,
							},
							{ revalidate: false },
						)
					: Promise.resolve(),
				saveMediaDetails(
					draft.id,
					{
						title: draft.title,
						overview: draft.overview,
						releaseDate: draft.releaseDate
							? draft.releaseDate.toISOString().slice(0, 10)
							: null,
						isAdult: draft.isAdult,
					},
					{ revalidate: false },
				),
				pendingPosterPath
					? updateMediaPoster(draft.id, pendingPosterPath, { revalidate: false })
					: Promise.resolve(),
				pendingBannerPath
					? updateMediaBanner(draft.id, pendingBannerPath, { revalidate: false })
					: Promise.resolve(),
			]);
			await finalizeMediaEditorSave(draft.id, draft.type, {
				includeActivity: Boolean(draft.review),
			});
			setPendingPosterPath(null);
			setPendingBannerPath(null);
			close();
		} catch (e) {
			// Surfaces saveReview's own message when that's what failed, rather than a
			// generic one that gives no clue which of the four requests rejected.
			setSaveError(
				e instanceof Error ? e.message : "Failed to save. Try again.",
			);
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
				initialRating: prev.review?.initialRating ?? null,
				liked: prev.review?.liked ?? false,
				difficulty: prev.review?.difficulty ?? null,
				body: prev.review?.body ?? null,
				bodyFr: prev.review?.bodyFr ?? null,
				featured: prev.review?.featured ?? false,
				inDigest: prev.review?.inDigest ?? false,
				reviewDate: prev.review?.reviewDate ?? null,
				createDate: prev.review?.createDate ?? new Date(),
				updateDate: prev.review?.updateDate ?? null,
				...patch,
			};
			return { ...prev, review };
		});
	}

	// Generic patch helper for base Media fields — normally owned by a provider's
	// ingest, editable here for media with no (or a wrong) provider match.
	function patchDetails(patch: {
		title?: string;
		overview?: string | null;
		releaseDate?: Date | null;
		isAdult?: boolean;
	}) {
		setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.wrapper_body}>
				<div className={styles.poster_column}>
					{draft && (
						<>
							<MediaPoster
								src={draft.posterSrc}
								title={draft.title}
								ratio={posterRatioFor(draft.type)}
							/>
							<EnrichedAgo
								lastEnrichedAt={draft.lastEnrichedAt}
								className={styles.enriched_ago}
							/>
						</>
					)}
				</div>

				<div className={styles.content_column}>
					{/* Base Media fields — normally owned by a source's ingest,
				editable here for the rare case of no/wrong provider match. */}
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
									className={styles.field_input_date}
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

							<div className={styles.details_row_secondary}>
								<label className={styles.field}>
									+18
									<input
										type="checkbox"
										className={styles.field_checkbox}
										checked={draft?.isAdult ?? false}
										onChange={(e) =>
											patchDetails({ isAdult: e.target.checked })
										}
									/>
								</label>
								<label className={styles.field}>
									Poster URL
									<div className={styles.url_input_row}>
										<input
											type="text"
											className={styles.field_input_wide}
											placeholder="https://…"
											value={posterUrlInput}
											onChange={(e) => setPosterUrlInput(e.target.value)}
										/>
										<button type="button" onClick={applyPosterUrl}>
											Use
										</button>
									</div>
									{posterUrlInput.trim() && (
										// Plain <img> (pasted URL any host, proxied/cached only once saved). eslint-disable @next/next/no-img-element.
										<img
											src={posterUrlInput.trim()}
											alt=""
											className={styles.url_preview}
										/>
									)}
									{pendingPosterPath === posterUrlInput.trim() &&
										posterUrlInput.trim() && (
											<span className={styles.url_applied}>
												Will apply on save
											</span>
										)}
								</label>
								<label className={styles.field}>
									Banner URL
									<div className={styles.url_input_row}>
										<input
											type="text"
											className={styles.field_input_wide}
											placeholder="https://…"
											value={bannerUrlInput}
											onChange={(e) => setBannerUrlInput(e.target.value)}
										/>
										<button type="button" onClick={applyBannerUrl}>
											Use
										</button>
									</div>
									{bannerUrlInput.trim() && (
										// Same reasoning as the poster URL preview above.
										// eslint-disable-next-line @next/next/no-img-element
										<img
											src={bannerUrlInput.trim()}
											alt=""
											className={styles.url_preview}
										/>
									)}
									{pendingBannerPath === bannerUrlInput.trim() &&
										bannerUrlInput.trim() && (
											<span className={styles.url_applied}>
												Will apply on save
											</span>
										)}
								</label>
							</div>
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
									<StarIcon />
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
									onChange={(e) => {
										// min/max only affect the spinner arrows, not a typed/pasted
										// value — clamp by hand so a stray "-3" or "99" can't reach patchReview.
										const parsed = Number(e.target.value);
										const clamped = Number.isFinite(parsed)
											? Math.min(2, Math.max(0, Math.round(parsed)))
											: 0;
										patchReview({ difficulty: clamped });
									}}
								/>
							</label>
							<div className={styles.field}>
								Rewatch
								<button
									type="button"
									className={styles.rewatch_button}
									disabled={isLoggingRewatch || rewatchLogged}
									onClick={handleLogRewatch}>
									{rewatchLogged
										? "Logged"
										: isLoggingRewatch
											? "Logging…"
											: "Log today"}
								</button>
							</div>
						</div>

						{/* Review body preview + edit button; actual editing (and the AI
					diff) happens in ReviewBodyModal, which has room to lay them side by side. */}
						<div className={styles.body_group}>
							<label className={styles.field}>Body</label>

							<button
								type="button"
								style={{ width: "5rem" }}
								onClick={() => setIsBodyModalOpen(true)}>
								Edit body
							</button>
						</div>
					</div>

					<span className={styles.divider} />

					<div className={styles.danger_zone}>
						<div className={styles.danger_zone_label}>Danger zone</div>
						{draft?.isDeleted && (
							<div className={styles.deleted_notice}>
								Soft-deleted — hidden from every list.
							</div>
						)}
						<div className={styles.danger_actions}>
							<button
								type="button"
								onClick={handleToggleDeleted}
								disabled={isDeleting}>
								{draft?.isDeleted ? "Restore" : "Soft delete"}
							</button>

							{!confirmHardDelete ? (
								<button
									type="button"
									className={styles.danger_button}
									onClick={() => setConfirmHardDelete(true)}
									disabled={isDeleting}>
									Delete permanently…
								</button>
							) : (
								<span className={styles.confirm_delete}>
									Permanently delete &quot;{draft?.title}&quot;? This removes
									its review, credits, and change log too, and cannot be undone.
									<button
										type="button"
										className={styles.danger_button}
										onClick={handleHardDelete}
										disabled={isDeleting}>
										{isDeleting ? "Deleting…" : "Yes, delete forever"}
									</button>
									<button
										type="button"
										onClick={() => setConfirmHardDelete(false)}
										disabled={isDeleting}>
										Cancel
									</button>
								</span>
							)}
						</div>
						{deleteError && (
							<div className={styles.save_error}>{deleteError}</div>
						)}
					</div>

					{saveError && <div className={styles.save_error}>{saveError}</div>}
				</div>
			</div>

			<div className={styles.actions}>
				<button onClick={handleSave} disabled={isSaving}>
					{isSaving ? "Saving…" : "Save"}
				</button>
				<button onClick={handleClose}>Close</button>
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
