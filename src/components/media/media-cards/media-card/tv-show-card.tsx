import { MediaCardShell } from "@/components/media/media-cards/media-card/media-card-shell";
import { MediaEpisodeInfo } from "@/components/media/primitives/episode-info";
import { MediaRecord } from "@/components/media/types";

type Props = {
	media: MediaRecord & { type: "TVSHOW" };
};

export function TvShowCard({ media }: Props) {
	return (
		<MediaCardShell media={media}>
			{/*<MediaEpisodeInfo*/}
			{/*	seasonCount={media.tvShow.seasonCount}*/}
			{/*	episodeCount={media.tvShow.episodeCount}*/}
			{/*/>*/}
		</MediaCardShell>
	);
}
