import { ReactNode } from "react";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaRecord } from "@/components/media/types";
import { StarIcon } from "@/components/media/icons/star-icon";
import styles from "./media-mini-card-shell.module.sass";
import { MediaEditButton } from "@/components/media/primitives/edit-button";
import { ReviewIcon } from "@/components/media/icons/review-icon";

type Props = {
	media: MediaRecord;
	// Type-specific bit (runtime for movies, episode count for TV, etc.)
	children?: ReactNode;
};

// Poster + title + rating only — for dense listings (grids) where the full
// MediaCardShell (review body, edit button, type-specific info) is too much.
// Per-type cards (MovieMiniCard, TvShowMiniCard, ...) supply only the bit of
// secondary info that actually differs between media types.
export function MediaMiniCardShell({ media, children }: Props) {
	return (
		<div className={styles.wrapper}>
			<MediaPoster
				src={media.posterSrc}
				title={media.title}
				mediaId={media.id}
				ratio={posterRatioFor(media.type)}
				difficulty={media.review?.difficulty}
			/>
			<MediaTitle title={media.title} className={styles.title} />
			<div className={styles.subtitle}>
				{media.review && (
					<div className={styles.rating}>
						{media.review.rating}
						<StarIcon size={11} />
					</div>
				)}
				{media.review && media.review.body && (
					<ReviewIcon size={9} title="Has review" />
				)}
				{children}
			</div>
			<MediaEditButton media={media} className={styles.edit_button} />
		</div>
	);
}
