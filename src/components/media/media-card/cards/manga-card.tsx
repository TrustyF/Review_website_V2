import { MediaCardShell } from "@/components/media/media-card/cards/media-card-shell";
import { MediaVolumeInfo } from "@/components/media/media-card/primitives/volume-info";
import { MediaRecord } from "@/components/media/media-card/types";

type Props = {
	media: MediaRecord & { type: "MANGA" };
};

export function MangaCard({ media }: Props) {
	return (
		<MediaCardShell media={media}>
			{/*<MediaVolumeInfo*/}
			{/*	volumeCount={media.manga.volumeCount}*/}
			{/*	chapterCount={media.manga.chapterCount}*/}
			{/*/>*/}
		</MediaCardShell>
	);
}
