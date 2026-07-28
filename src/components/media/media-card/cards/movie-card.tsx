import { MediaPoster } from "@/components/media/media-card/primitives/poster";
import { MediaReleaseDate } from "@/components/media/media-card/primitives/release-date";
import { MediaReview } from "@/components/media/media-card/components/review/review";
import { MediaRuntime } from "@/components/media/media-card/primitives/runtime";
import { MediaTitle } from "@/components/media/media-card/primitives/title";
import { MediaRecord } from "@/components/media/media-card/types";
import styles from "./movie-card.module.sass";
import { MediaEditButton } from "@/components/media/media-card/primitives/edit-button";

type Props = {
	media: MediaRecord & { type: "MOVIE" | "SHORT" };
	showEditButton?: boolean;
};

export function MovieCard({ media, showEditButton = true }: Props) {
	return (
		<div className={styles.wrapper}>
			{showEditButton && <MediaEditButton mediaId={media.id} />}
			<div className={styles.poster}>
				<MediaPoster
					src={media.posterSrc}
					title={media.title}
				/>
			</div>
			<div className={styles.body}>
				<div className={styles.header_info}>
					<MediaTitle title={media.title} />
					<MediaReleaseDate date={media.releaseDate} />
				</div>
				<MediaReview review={media.review} />
			</div>
			<div className={styles.secondary_info}>
				<MediaRuntime runtime={media.movie.runtime} />
			</div>
		</div>
	);
}
