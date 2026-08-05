import { MediaMiniCardShell } from "@/components/media/media-card/cards-mini/media-mini-card-shell";
import { formatVolumeInfo } from "@/components/media/media-card/primitives/volume-info";
import { MediaRecord } from "@/components/media/media-card/types";
import styles from "./media-mini-card-shell.module.sass";
import { MediaTitle } from "@/components/media/media-card/primitives/title";

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
			{/*<MediaTitle*/}
			{/*	title={media.title}*/}
			{/*	className={styles.title}*/}
			{/*/>*/}
			{/*{volumeInfo && <div className={styles.info}>{volumeInfo}</div>}*/}
		</MediaMiniCardShell>
	);
}
