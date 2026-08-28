"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clickable } from "@/components/ui/clickable";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import {
	publishMediaEdits,
	saveReview,
	updateMediaBanner,
	updateMediaBannerFocus,
	updateMediaPoster,
} from "@/components/media/media-management/media-editor/media-editor-actions";
import { useMediaPublishStore } from "@/components/media/media-management/media-detail-inline-editor/media-publish-store";
import styles from "./media-publish-button.module.sass";

type Props = {
	mediaId: number;
};

// PosterEditTrigger/BannerEditTrigger/ReviewBodyEditTrigger stage every
// poster/banner pick, focus-slider drag, and review body edit into
// media-publish-store instead of writing to the DB (see their own
// onStage/stageBannerFocus/stageReview comments) — so an admin can try a few
// options against the live preview without any of it being real yet. This is
// the one button that actually commits the staged draft: the DB writes it
// was deferring, and one revalidation for all of them together — instead of
// every single pick hitting the DB and wiping the ISR cache on its own (see
// media-editor-actions.ts's own comment on the ISR write quota this was
// blowing through).
export function MediaPublishButton({ mediaId }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported (see nav-admin-links.tsx
	// for the same rule applied to the navbar's own admin links).
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const draft = useMediaPublishStore((s) => s.draft);
	const clear = useMediaPublishStore((s) => s.clear);
	const router = useRouter();
	const [isPublishing, setIsPublishing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!isAdmin) return null;
	if (!draft || draft.mediaId !== mediaId) return null;

	// Just drops the staged draft — every trigger reads straight off it
	// (falling back to the last-published value once it's null), so clearing
	// it is all reverting the live preview needs.
	function handleCancel() {
		clear();
		setError(null);
	}

	async function handlePublish() {
		if (!draft) return;
		setIsPublishing(true);
		setError(null);
		try {
			// Each write skips its own revalidation (revalidate: false) — a
			// single publishMediaEdits below covers all three at once, rather
			// than each one separately wiping the same paths.
			await Promise.all([
				draft.posterPath
					? updateMediaPoster(mediaId, draft.posterPath, { revalidate: false })
					: Promise.resolve(),
				draft.bannerPath
					? updateMediaBanner(mediaId, draft.bannerPath, { revalidate: false })
					: Promise.resolve(),
				draft.bannerFocusY != null
					? updateMediaBannerFocus(mediaId, draft.bannerFocusY, {
							revalidate: false,
						})
					: Promise.resolve(),
				draft.pendingReview
					? saveReview(mediaId, draft.pendingReview, { revalidate: false })
					: Promise.resolve(),
			]);
			await publishMediaEdits(mediaId, {
				includeActivity: draft.pendingReview != null,
			});
			clear();
			// Cheap now that the server-side cache is already fresh — just gets
			// this admin's own tab to reflect it immediately too, rather than
			// waiting on the next full navigation.
			router.refresh();
		} catch {
			setError("Failed to publish. Try again.");
		} finally {
			setIsPublishing(false);
		}
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.button_row}>
				<Clickable
					className={styles.cancel_button}
					onClick={handleCancel}
					disabled={isPublishing}
					aria-label="Discard staged media changes">
					Cancel
				</Clickable>
				<Clickable
					className={styles.button}
					onClick={handlePublish}
					disabled={isPublishing}
					aria-label="Publish media changes">
					{isPublishing ? "Publishing…" : "Publish changes"}
				</Clickable>
			</div>
			{error && <div className={styles.error}>{error}</div>}
		</div>
	);
}
