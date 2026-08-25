import { ReactNode } from "react";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import {
	MediaReviewMeta,
	MediaReviewBody,
} from "@/components/media/media-cards/media-card/review";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaEditButton } from "@/components/media/primitives/edit-button";
import { MediaRecord } from "@/components/media/types";
import styles from "./media-card-shell-mobile.module.sass";

type Props = {
	media: MediaRecord;
	// Type-specific bit (runtime for movies, episode count for TV, etc.)
	children?: ReactNode;
};

// Mobile-width counterpart to MediaCardShell — same poster/title/date/
// review/edit-button pieces (kept in sync by hand, same as that file), just
// laid out so the review sits on its own full-width row under the poster +
// title row instead of squeezed into the ~130px-narrower column beside a
// fixed-width poster that works fine at desktop widths but leaves barely any
// room for review text on a phone. MediaCardResolver's per-type cards still
// only ever render MediaCardShell directly — see that file's own comment on
// how the two swap in via CSS instead of either component picking its own
// counterpart.
export function MediaCardShellMobile({ media, children }: Props) {
	return (
		<div className={styles.wrapper}>
			<div className={styles.poster}>
				<MediaPoster
					src={media.posterSrc}
					title={media.title}
					mediaId={media.id}
					ratio={posterRatioFor(media.type)}
				/>
			</div>
			<div className={styles.top}>
				<div className={styles.header_info}>
					<MediaTitle title={media.title} />
				</div>
				{children && <div className={styles.secondary_info}>{children}</div>}
				<MediaReviewMeta
					review={media.review}
					watchedDate={media.watchedDate}
				/>
			</div>
			{media.review?.body && (
				<div className={styles.review}>
					<MediaReviewBody review={media.review} />
				</div>
			)}
			<MediaEditButton media={media} className={styles.edit_button} />
		</div>
	);
}
