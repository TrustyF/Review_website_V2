import { MediaPoster } from "@/components/media/primitives/poster";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaRecord } from "@/components/media/types";
import styles from "./movie-card.module.sass";

type Props = {
	media: MediaRecord & { movie: NonNullable<MediaRecord["movie"]> };
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
			<div className={styles.header_info}>
				<MediaTitle title={media.title} />
				<MediaReleaseDate date={media.releaseDate} />
			</div>
			<div className={styles.secondary_info}>
				<span className={styles.runtime}>{media.movie.runtime} min</span>
			</div>
		</div>
	);
}
