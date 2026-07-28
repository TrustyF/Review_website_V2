import { ReactNode } from "react";
import { MediaPoster } from "@/components/media/media-card/primitives/poster";
import { MediaReleaseDate } from "@/components/media/media-card/primitives/release-date";
import { MediaReview } from "@/components/media/media-card/components/review/review";
import { MediaTitle } from "@/components/media/media-card/primitives/title";
import { MediaEditButton } from "@/components/media/media-card/primitives/edit-button";
import { MediaRecord } from "@/components/media/media-card/types";
import styles from "./media-card-shell.module.sass";

type Props = {
	media: MediaRecord;
	// Type-specific bit (runtime for movies, episode count for TV, etc.)
	children?: ReactNode;
};

// Shared layout for every card type: poster, title, release date, review,
// edit button. Per-type cards (MovieCard, TvShowCard, ...) supply only the
// bit of secondary info that actually differs between media types.
// MediaEditButton decides for itself whether it's allowed to render.
export function MediaCardShell({ media, children }: Props) {
	return (
		<div className={styles.wrapper}>
			<MediaEditButton mediaId={media.id} />
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
			{children && <div className={styles.secondary_info}>{children}</div>}
		</div>
	);
}
