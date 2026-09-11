import { MediaMiniCardShell } from "@/components/media/media-cards/media-mini-card/media-mini-card-shell";
import { formatRuntime } from "@/components/media/primitives/runtime";
import {
	formatReleaseDate,
	formatTimeUntilRelease,
} from "@/components/media/primitives/release-date";
import { useMediaCardDisplay } from "@/components/media/media-card-display-context";
import { useLocale } from "@/lib/i18n/i18n-context";
import { MediaRecord } from "@/components/media/types";
import styles from "./media-mini-card-shell.module.sass";

type Props = {
	media: MediaRecord & { type: "MOVIE" | "SHORT" };
};

export function MovieMiniCard({ media }: Props) {
	const { showReleaseDate } = useMediaCardDisplay();
	const locale = useLocale();
	const runtime = formatRuntime(media.movie.runtime);
	const releaseDate = formatReleaseDate(media.releaseDate, locale);
	const timeUntilRelease = formatTimeUntilRelease(media.releaseDate, locale);

	return (
		<MediaMiniCardShell media={media}>
			{/*{runtime && <div className={styles.info}>{runtime}</div>}*/}
			{showReleaseDate && releaseDate && (
				<div className={`${styles.info} ${styles.release_date_info}`}>
					{timeUntilRelease && `${timeUntilRelease} - `}
					{releaseDate}
				</div>
			)}
		</MediaMiniCardShell>
	);
}
