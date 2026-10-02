import { ReactNode, useState } from "react";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaRecord } from "@/components/media/types";
import { StarIcon } from "@/components/media/icons/star-icon";
import styles from "./media-mini-card-shell.module.sass";
import { MediaEditButton } from "@/components/media/primitives/edit-button";
import { ReviewIcon } from "@/components/media/icons/review-icon";
import { HeartIcon } from "@/components/media/icons/heart-icon";
import { useMediaCardDisplay } from "@/components/media/media-card-display-context";
/* eslint-disable-next-line comment-length/flag-long -- disabled imports, not prose */
// Disabled below for now — may come back later.
// import { AddToWatchlistHoverButton } from "@/components/watchlist/add-to-watchlist-button/add-to-watchlist-hover-button";
// import { MarkAsWatchedHoverButton } from "@/components/media/media-cards/media-mini-card/mark-as-watched-hover-button";
import { PosterQuickEditButton } from "@/components/media/media-cards/media-mini-card/poster-quick-edit-button";
import { useWatched } from "@/components/watched/watched-context";
import { useWatchlist } from "@/components/watchlist/watchlist-context";
import { WatchlistIcon } from "@/components/icons/watchlist-icon";
import { useDictionary } from "@/lib/i18n/i18n-context";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useMediaSelection } from "@/components/media/media-grids/media-selection/media-selection-context";
import { MediaSelectOverlay } from "@/components/media/media-grids/media-selection/media-select-overlay";

type Props = {
	media: MediaRecord;
	// Type-specific bit (runtime for movies, episode count for TV, etc.)
	children?: ReactNode;
};

// Poster + title + rating only, for dense grid listings where full MediaCardShell is too much; per-type cards supply only the differing secondary info.
export function MediaMiniCardShell({ media, children }: Props) {
	const { showRating, showTitle, showReviewIcon, showWatchlistPill, fade } =
		useMediaCardDisplay();
	const dict = useDictionary();
	const { isWatched } = useWatched();
	const { isInWatchlist } = useWatchlist();
	const isAdmin = useIsAdmin();
	const selection = useMediaSelection();
	const isSelecting = selection?.isActive ?? false;
	const isSelected = isSelecting && selection!.selectedIds.has(media.id);
	// Set optimistically when an alternate is picked — resolvePoster defers its resize/encode
	// to after(), so the picker's own previewSrc (already resolved) stands in until it's ready.
	const [posterOverrideSrc, setPosterOverrideSrc] = useState<string | null>(
		null,
	);

	return (
		<div
			className={
				// Selected cards drop the watched dimming so the selection reads clearly.
				isWatched(media.id) && !isSelected
					? `${styles.wrapper} ${styles.watched}`
					: styles.wrapper
			}>
			<div className={styles.poster_container}>
				<MediaPoster
					src={posterOverrideSrc ?? media.posterSrc}
					title={media.title}
					mediaId={media.id}
					ratio={posterRatioFor(media.type)}
					difficulty={media.review?.difficulty}
					fade={fade}
				/>
				{showWatchlistPill && !isAdmin && isInWatchlist(media.id) && (
					<span
						className={styles.watchlist_pill}
						role="img"
						aria-label={dict.watchlist.inWatchlist}>
						<WatchlistIcon size={11} />
					</span>
				)}
				{isSelecting && (
					<MediaSelectOverlay
						title={media.title}
						selected={isSelected}
						onToggle={() => selection!.toggle(media.id)}
					/>
				)}
				{/* eslint-disable-next-line comment-length/no-very-long -- disabled code, not prose */}
				{/* Disabled for now — may come back later.
				<div className={styles.status_buttons}>
					<AddToWatchlistHoverButton mediaId={media.id} />
					<MarkAsWatchedHoverButton mediaId={media.id} type={media.type} />
				</div>
				*/}
			</div>
			<div className={styles.info_group}>
				{showTitle && (
					<MediaTitle
						title={media.title}
						titleFr={media.titleFr}
						className={styles.title}
					/>
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
					{showReviewIcon && media.review?.liked && (
						<HeartIcon size={11} title="Liked" />
					)}
					{children}
				</div>
			</div>
			{!isSelecting && (
				<div className={styles.admin_actions}>
					<MediaEditButton media={media} hitboxPadding={6} />
					<PosterQuickEditButton
						media={media}
						onPosterChange={setPosterOverrideSrc}
						hitboxPadding={6}
					/>
				</div>
			)}
		</div>
	);
}
