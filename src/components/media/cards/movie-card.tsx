import { MediaPoster } from "@/components/media/primitives/poster";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { MediaReview } from "@/components/media/components/review";
import { MediaRuntime } from "@/components/media/primitives/runtime";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaRecord } from "@/components/media/types";
import styles from "./movie-card.module.sass";

type Props = {
	media: MediaRecord & { type: "MOVIE" | "SHORT" };
};

export async function MovieCard({ media }: Props) {
	return (
		<div className={styles.wrapper}>
			<div className={styles.poster}>
				<MediaPoster
					mediaId={media.id}
					posterPath={media.posterPath}
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
			{/*<div className={styles.secondary_info}>*/}
			{/*	<MediaRuntime runtime={media.movie.runtime} />*/}
			{/*</div>*/}
		</div>
	);
}
