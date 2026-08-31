import { ReactNode } from "react";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { MediaReview } from "@/components/media/media-cards/media-card/review";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaEditButton } from "@/components/media/primitives/edit-button";
import { MediaRecord } from "@/components/media/types";
import { MediaCardShellMobile } from "@/components/media/media-cards/media-card/media-card-shell-mobile";
import styles from "./media-card-shell.module.sass";

type Props = {
	media: MediaRecord;
	// Type-specific bit (runtime for movies, episode count for TV, etc.)
	children?: ReactNode;
};

// Shared layout for every card type; per-type cards supply only the differing secondary info.
// Renders both this and the mobile layout, swapping visibility via CSS breakpoint instead of matchMedia so this stays a server component with no first-paint mismatch.
export function MediaCardShell({ media, children }: Props) {
	return (
		<>
			<div className={styles.wrapper}>
				<div className={styles.poster}>
					<MediaPoster
						src={media.posterSrc}
						title={media.title}
						mediaId={media.id}
						ratio={posterRatioFor(media.type)}
					/>
				</div>
				<div className={styles.body}>
					<div className={styles.header_info}>
						<MediaTitle title={media.title} />
						<MediaReleaseDate date={media.releaseDate} />
					</div>
					<MediaReview review={media.review} watchedDate={media.watchedDate} />
				</div>
				{children && <div className={styles.secondary_info}>{children}</div>}
				<MediaEditButton media={media} className={styles.edit_button} />
			</div>
			<MediaCardShellMobile media={media}>{children}</MediaCardShellMobile>
		</>
	);
}
