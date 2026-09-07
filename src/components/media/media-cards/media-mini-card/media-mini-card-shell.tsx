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
import { MarkAsWatchedHoverButton } from "@/components/media/media-cards/media-mini-card/mark-as-watched-hover-button";
import { PosterQuickEditButton } from "@/components/media/media-cards/media-mini-card/poster-quick-edit-button";
import { useWatched } from "@/components/watched/watched-context";

type Props = {
	media: MediaRecord;
	// Type-specific bit (runtime for movies, episode count for TV, etc.)
	children?: ReactNode;
};

// Poster + title + rating only, for dense grid listings where full MediaCardShell is too much; per-type cards supply only the differing secondary info.
export function MediaMiniCardShell({ media, children }: Props) {
	const { showRating, showTitle, showReviewIcon } = useMediaCardDisplay();
	const { isWatched } = useWatched();
	// Set optimistically when an alternate is picked — resolvePoster defers its resize/encode
	// to after(), so the picker's own previewSrc (already resolved) stands in until it's ready.
	const [posterOverrideSrc, setPosterOverrideSrc] = useState<string | null>(
		null,
	);

	return (
		<div
			className={
				isWatched(media.id)
					? `${styles.wrapper} ${styles.watched}`
					: styles.wrapper
			}>
			<MediaPoster
				src={posterOverrideSrc ?? media.posterSrc}
				title={media.title}
				mediaId={media.id}
				ratio={posterRatioFor(media.type)}
				difficulty={media.review?.difficulty}
			/>
			<div className={styles.info_group}>
				{showTitle && (
					<MediaTitle title={media.title} className={styles.title} />
				)}
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
			</div>
			<div className={styles.status_buttons}>
				<AddToWatchlistHoverButton mediaId={media.id} />
				<MarkAsWatchedHoverButton mediaId={media.id} type={media.type} />
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
