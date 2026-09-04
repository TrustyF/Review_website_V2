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
	// Computed by the server component from Date.now() vs media.releaseDate —
	// kept out of this client component since comparing against the current
	// time during render trips react-hooks/purity.
	isUpcoming: boolean;
};

const ReleaseDateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
});

function UpcomingReviewPlaceholder({ date }: { date: Date | null }) {
	return (
		<div className={styles.upcoming}>
			{date ? `Releasing ${ReleaseDateFormatter.format(date)}` : "Not yet released"}
		</div>
	);
}

// Drop-in replacement for <MediaReview> — click to open the same body editor (with AI diff) the
// full editor modal uses. Closing it stages the edit into media-publish-store instead of saving
// immediately, same as the poster/banner triggers.
//
// Scoped to the whole review card, not just the body text, since MediaReview (a shared primitive
// used everywhere) doesn't expose its body as a separate targetable sub-element.
export function ReviewBodyEditTrigger({ media, isUpcoming }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const review = media.review;

	const draft = useMediaPublishStore((s) => s.draft);
	const stageReview = useMediaPublishStore((s) => s.stageReview);
	const draftBody =
		draft?.mediaId === media.id ? draft.pendingReview?.body : undefined;

	const [body, setBody] = useState(draftBody ?? review?.body ?? "");
	const [isOpen, setIsOpen] = useState(false);

	if (!review && isUpcoming) {
		return <UpcomingReviewPlaceholder date={media.releaseDate} />;
	}

	if (!review || !isAdmin) {
		return <MediaReview review={review} watchedDate={media.watchedDate} />;
	}

	// Synchronous — nothing here touches the network; the actual save happens on Publish.
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
