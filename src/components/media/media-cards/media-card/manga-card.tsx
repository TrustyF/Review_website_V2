import { MediaCardShell } from "@/components/media/media-cards/media-card/media-card-shell";
import { MediaVolumeInfo } from "@/components/media/primitives/volume-info";
import { MediaRecord } from "@/components/media/types";

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
