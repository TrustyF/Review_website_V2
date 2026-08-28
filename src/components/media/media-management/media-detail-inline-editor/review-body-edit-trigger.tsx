"use client";
import { useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaReview } from "@/components/media/media-cards/media-card/review";
import { Hitbox } from "@/components/ui/hitbox";
import { ReviewBodyModal } from "@/components/media/media-management/media-editor/components/review-body-modal";
import { useMediaPublishStore } from "@/components/media/media-management/media-detail-inline-editor/media-publish-store";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import styles from "./review-body-edit-trigger.module.sass";

type Props = {
	media: MediaRecord;
};

// Drop-in replacement for a plain <MediaReview> on the detail page — click
// anywhere in the review to open the same body editor (with its AI
// suggestion diff) the full editor modal uses. Closing it stages the edit
// into the page-level draft (media-publish-store) instead of saving
// immediately — same as PosterEditTrigger/BannerEditTrigger, so every
// inline edit on this page commits together behind MediaPublishButton's
// Publish click.
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

	const draft = useMediaPublishStore((s) => s.draft);
	const stageReview = useMediaPublishStore((s) => s.stageReview);
	const draftBody =
		draft?.mediaId === media.id ? draft.pendingReview?.body : undefined;

	const [body, setBody] = useState(draftBody ?? review?.body ?? "");
	const [isOpen, setIsOpen] = useState(false);

	if (!review || !isAdmin) {
		return <MediaReview review={review} watchedDate={media.watchedDate} />;
	}

	// Synchronous, since nothing here touches the network (see
	// media-publish-store.ts's stageReview) — the actual save happens once
	// MediaPublishButton's Publish is clicked.
	function handleClose() {
		setIsOpen(false);
		stageReview(media.id, {
			rating: review!.rating,
			liked: review!.liked,
			difficulty: review!.difficulty,
			body,
		});
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
		</div>
	);
}
