import { MediaCardShell } from "@/components/media/media-card/cards/media-card-shell";
import { MediaEpisodeInfo } from "@/components/media/media-card/primitives/episode-info";
import { MediaRecord } from "@/components/media/media-card/types";

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
