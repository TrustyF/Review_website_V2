"use client";
import { useState } from "react";
import { MediaRecord } from "@/components/media/types";
import {
	MediaReview,
	MediaReviewDisplay,
} from "@/components/media/media-cards/media-card/review";
import { Hitbox } from "@/components/ui/hitbox";
import { ReviewBodyModal } from "@/components/media/media-management/media-editor/components/review-body-modal";
import { useMediaPublishStore } from "@/components/media/media-management/media-detail-inline-editor/media-publish-store";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import styles from "./review-body-edit-trigger.module.sass";

type Props = {
	media: MediaRecord;
	// Server-computed to avoid Date.now() comparison during render (purity violation)
	isUpcoming: boolean;
};

// Drop-in <MediaReview> replacement: click to open body editor with AI diff. Closing stages edit to media-publish-store (not save). Scoped to whole card since MediaReview doesn't expose body as targetable sub-element.
export function ReviewBodyEditTrigger({ media, isUpcoming }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const review = media.review;

	const draft = useMediaPublishStore((s) => s.draft);
	const stageReview = useMediaPublishStore((s) => s.stageReview);
	const pendingReview = draft?.mediaId === media.id ? draft.pendingReview : undefined;

	const [body, setBody] = useState(pendingReview?.body ?? review?.body ?? "");
	const [bodyFr, setBodyFr] = useState(pendingReview?.bodyFr ?? review?.bodyFr ?? "");
	const [isOpen, setIsOpen] = useState(false);

	if (!review || !isAdmin) {
		return (
			<MediaReviewDisplay
				review={review}
				watchedDate={media.watchedDate}
				type={media.type}
				releaseDate={media.releaseDate}
				isUpcoming={isUpcoming}
			/>
		);
	}

	// Synchronous — nothing here touches the network; the actual save happens on Publish.
	function handleClose() {
		setIsOpen(false);
		stageReview(media.id, {
			rating: review!.rating,
			liked: review!.liked,
			difficulty: review!.difficulty,
			body,
			bodyFr,
		});
	}

	return (
		<div className={styles.wrapper}>
			<Hitbox
				className={styles.hitbox}
				onClick={() => setIsOpen(true)}>
				<MediaReview
					review={{ ...review, body }}
					watchedDate={media.watchedDate}
					type={media.type}
				/>
				<div className={styles.hover_badge}>Edit review body</div>
			</Hitbox>

			{isOpen && (
				<ReviewBodyModal
					body={body}
					onChange={setBody}
					bodyFr={bodyFr}
					onChangeFr={setBodyFr}
					onClose={handleClose}
				/>
			)}
		</div>
	);
}
