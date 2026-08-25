"use client";
import { useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaReview } from "@/components/media/media-cards/media-card/review";
import { Hitbox } from "@/components/ui/hitbox";
import { ReviewBodyModal } from "@/components/media/media-management/media-editor/components/review-body-modal";
import { saveReview } from "@/components/media/media-management/media-editor/media-editor-actions";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import styles from "./review-body-edit-trigger.module.sass";

type Props = {
	media: MediaRecord;
};

// Drop-in replacement for a plain <MediaReview> on the detail page — click
// anywhere in the review to open the same body editor (with its AI
// suggestion diff) the full editor modal uses. Closing it saves immediately
// rather than waiting on a separate Save step, same as PosterEditTrigger/
// BannerEditTrigger — there's no other "commit" action anywhere else on
// this page to batch behind.
//
// Scoped to the whole review card rather than just its body text: MediaReview
// doesn't expose its body as a separately-targetable sub-element (nor
// should it grow an edit-mode prop just for this — it's a shared primitive
// used by every card and grid on the site), so clicking the rating/date
// here opens the body editor too. A media with no review yet renders
// nothing either way (MediaReview itself returns null), same as before —
// creating a first review still goes through the full editor.
export function ReviewBodyEditTrigger({ media }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported (see nav-admin-links.tsx
	// for the same rule applied to the navbar's own admin links).
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const review = media.review;

	const [body, setBody] = useState(review?.body ?? "");
	const [isOpen, setIsOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!review || !isAdmin) {
		return <MediaReview review={review} watchedDate={media.watchedDate} />;
	}

	async function handleClose() {
		setIsOpen(false);
		setIsSaving(true);
		setError(null);
		try {
			await saveReview(media.id, {
				rating: review!.rating,
				liked: review!.liked,
				difficulty: review!.difficulty,
				body,
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to save. Try again.");
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<div className={styles.wrapper}>
			<Hitbox
				className={styles.hitbox}
				onClick={() => setIsOpen(true)}>
				<MediaReview review={{ ...review, body }} watchedDate={media.watchedDate} />
				<div className={styles.hover_badge}>Edit review body</div>
			</Hitbox>

			{isOpen && (
				<ReviewBodyModal
					body={body}
					onChange={setBody}
					onClose={handleClose}
				/>
			)}

			{isSaving && <div className={styles.status}>Saving…</div>}
			{error && <div className={styles.status_error}>{error}</div>}
		</div>
	);
}
