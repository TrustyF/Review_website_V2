import { MediaPoster } from "@/components/media/media-card/primitives/poster";
import { MediaTitle } from "@/components/media/media-card/primitives/title";
import { MediaRecord } from "@/components/media/media-card/types";
import { StarIcon } from "@/components/media/icons/star-icon";
import styles from "./media-mini-card.module.sass";

type Props = {
	media: MediaRecord;
};

// Poster + title + rating only — for dense listings (grids) where the full
// MediaCardShell (review body, edit button, type-specific info) is too much.
export function MediaMiniCard({ media }: Props) {
	return (
		<div className={styles.wrapper}>
			<MediaPoster
				src={media.posterSrc}
				title={media.title}
			/>
			<MediaTitle
				title={media.title}
				className={styles.title}
			/>
			{media.review && (
				<div className={styles.rating}>
					{media.review.rating}
					<StarIcon className={styles.rating_star} />
				</div>
			)}
		</div>
	);
}
