import { MediaCardShell } from "@/components/media/media-cards/media-card/media-card-shell";
import { MediaVolumeInfo } from "@/components/media/primitives/volume-info";
import { MediaRecord } from "@/components/media/types";

type Props = {
	media: MediaRecord & { type: "COMIC" };
};

export function ComicCard({ media }: Props) {
	return (
		<MediaCardShell media={media}>
			{/*<MediaVolumeInfo*/}
			{/*	volumeCount={media.comic.volumeCount}*/}
			{/*	chapterCount={media.comic.chapterCount}*/}
			{/*/>*/}
		</MediaCardShell>
	);
}
