import { MediaMiniCardShell } from "@/components/media/media-cards/media-mini-card/media-mini-card-shell";
import { formatEpisodeInfo } from "@/components/media/primitives/episode-info";
import {
	formatReleaseDate,
	formatTimeUntilRelease,
} from "@/components/media/primitives/release-date";
import { useMediaCardDisplay } from "@/components/media/media-card-display-context";
import { useLocale } from "@/lib/i18n/i18n-context";
import { MediaRecord } from "@/components/media/types";
import styles from "./media-mini-card-shell.module.sass";

type Props = {
	media: MediaRecord & { type: "TVSHOW" };
};

export function TvShowMiniCard({ media }: Props) {
	const { showReleaseDate } = useMediaCardDisplay();
	const locale = useLocale();
	const episodeInfo = formatEpisodeInfo(
		media.tvShow.seasonCount,
		media.tvShow.episodeCount,
	);
	const releaseDate = formatReleaseDate(media.releaseDate, locale);
	const timeUntilRelease = formatTimeUntilRelease(media.releaseDate, locale);

	return (
		<MediaMiniCardShell media={media}>
			{/*{episodeInfo && <div className={styles.info}>{episodeInfo}</div>}*/}
			{showReleaseDate && releaseDate && (
				<div className={`${styles.info} ${styles.release_date_info}`}>
					{timeUntilRelease && `${timeUntilRelease} - `}
					{releaseDate}
				</div>
			)}
		</MediaMiniCardShell>
	);
}
