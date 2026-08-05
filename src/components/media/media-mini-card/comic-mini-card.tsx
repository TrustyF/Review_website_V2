import { MediaMiniCardShell } from "@/components/media/media-mini-card/media-mini-card-shell";
import { formatVolumeInfo } from "@/components/media/primitives/volume-info";
import { MediaRecord } from "@/components/media/types";
import styles from "./media-mini-card-shell.module.sass";
import { MediaTitle } from "@/components/media/primitives/title";

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
			<MediaTitle
				title={media.title}
				className={styles.title}
			/>
			{/*{volumeInfo && <div className={styles.info}>{volumeInfo}</div>}*/}
		</MediaMiniCardShell>
	);
}
