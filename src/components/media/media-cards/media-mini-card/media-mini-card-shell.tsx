import { ReactNode, useState } from "react";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaRecord } from "@/components/media/types";
import { StarIcon } from "@/components/media/icons/star-icon";
import styles from "./media-mini-card-shell.module.sass";
import { MediaEditButton } from "@/components/media/primitives/edit-button";
import { ReviewIcon } from "@/components/media/icons/review-icon";
import { useMediaCardDisplay } from "@/components/media/media-card-display-context";
import { AddToWatchlistHoverButton } from "@/components/watchlist/add-to-watchlist-button/add-to-watchlist-hover-button";
import { MarkAsSeenHoverButton } from "@/components/media/media-cards/media-mini-card/mark-as-seen-hover-button";
import { PosterQuickEditButton } from "@/components/media/media-cards/media-mini-card/poster-quick-edit-button";

type Props = {
	media: MediaRecord;
	// Type-specific bit (runtime for movies, episode count for TV, etc.)
	children?: ReactNode;
};

// Poster + title + rating only, for dense grid listings where full MediaCardShell is too much; per-type cards supply only the differing secondary info.
export function MediaMiniCardShell({ media, children }: Props) {
	const { showRating, showTitle, showReviewIcon } = useMediaCardDisplay();
	// Set optimistically as soon as an alternate is picked — the freshly-saved posterPath's
	// resolved image isn't guaranteed to exist yet (resolvePoster defers its resize/encode to
	// after()), so pointing MediaPoster at it immediately would show a broken image until that
	// finishes. The picker's own previewSrc is already a real, fully-resolved image.
	const [posterOverrideSrc, setPosterOverrideSrc] = useState<string | null>(
		null,
	);

	return (
		<div className={styles.wrapper}>
			<MediaPoster
				src={posterOverrideSrc ?? media.posterSrc}
				title={media.title}
				mediaId={media.id}
				ratio={posterRatioFor(media.type)}
				difficulty={media.review?.difficulty}
			/>
			{showTitle && <MediaTitle title={media.title} className={styles.title} />}
			<div className={styles.subtitle}>
				{showRating && media.review && (
					<div className={styles.rating}>
						{media.review.rating}
						<StarIcon size={11} />
					</div>
				)}
				{showReviewIcon && media.review && media.review.body && (
					<ReviewIcon size={9} title="Has review" />
				)}
				{children}
			</div>
			<div className={styles.status_buttons}>
				<AddToWatchlistHoverButton mediaId={media.id} />
				{/*<MarkAsSeenHoverButton mediaId={media.id} />*/}
			</div>
			<div className={styles.admin_actions}>
				<MediaEditButton media={media} hitboxPadding={6} />
				<PosterQuickEditButton
					media={media}
					onPosterChange={setPosterOverrideSrc}
					hitboxPadding={6}
				/>
			</div>
		</div>
	);
}
