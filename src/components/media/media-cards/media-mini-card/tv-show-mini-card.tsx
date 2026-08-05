import { MediaMiniCardShell } from "@/components/media/media-cards/media-mini-card/media-mini-card-shell";
import { formatEpisodeInfo } from "@/components/media/primitives/episode-info";
import { MediaRecord } from "@/components/media/types";
import styles from "./media-mini-card-shell.module.sass";

type Props = {
	media: MediaRecord & { type: "TVSHOW" };
};

export function TvShowMiniCard({ media }: Props) {
	const episodeInfo = formatEpisodeInfo(
		media.tvShow.seasonCount,
		media.tvShow.episodeCount,
	);

	return (
		<MediaMiniCardShell media={media}>
			{episodeInfo && <div className={styles.info}>{episodeInfo}</div>}
		</MediaMiniCardShell>
	);
}
