import { MediaMiniCardShell } from "@/components/media/media-cards/media-mini-card/media-mini-card-shell";
import { formatVolumeInfo } from "@/components/media/primitives/volume-info";
import { MediaRecord } from "@/components/media/types";

type Props = {
	media: MediaRecord & { type: "COMIC" };
};

export function ComicMiniCard({ media }: Props) {
	const volumeInfo = formatVolumeInfo(
		media.comic.volumeCount,
		media.comic.chapterCount,
	);

	return (
		<MediaMiniCardShell media={media}>
			{/*{volumeInfo && <div className={styles.info}>{volumeInfo}</div>}*/}
		</MediaMiniCardShell>
	);
}
