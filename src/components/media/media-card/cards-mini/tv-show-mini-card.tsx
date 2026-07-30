import { MediaMiniCardShell } from "@/components/media/media-card/cards-mini/media-mini-card-shell";
import { formatEpisodeInfo } from "@/components/media/media-card/primitives/episode-info";
import { MediaRecord } from "@/components/media/media-card/types";
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
