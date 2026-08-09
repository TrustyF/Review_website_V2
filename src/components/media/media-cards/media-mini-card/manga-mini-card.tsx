import { MediaMiniCardShell } from "@/components/media/media-cards/media-mini-card/media-mini-card-shell";
import { formatVolumeInfo } from "@/components/media/primitives/volume-info";
import { MediaRecord } from "@/components/media/types";
import styles from "./media-mini-card-shell.module.sass";
import { MediaTitle } from "@/components/media/primitives/title";

type Props = {
	media: MediaRecord & { type: "MANGA" };
};

export function MangaMiniCard({ media }: Props) {
	const volumeInfo = formatVolumeInfo(
		media.manga.volumeCount,
		media.manga.chapterCount,
	);

	return (
		<MediaMiniCardShell media={media}>
			<MediaTitle title={media.title} className={styles.title} />
			{/*{volumeInfo && <div className={styles.info}>{volumeInfo}</div>}*/}
		</MediaMiniCardShell>
	);
}
