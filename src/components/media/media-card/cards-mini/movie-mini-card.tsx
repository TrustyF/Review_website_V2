import { MediaMiniCardShell } from "@/components/media/media-card/cards-mini/media-mini-card-shell";
import { formatRuntime } from "@/components/media/media-card/primitives/runtime";
import { MediaRecord } from "@/components/media/media-card/types";
import styles from "./media-mini-card-shell.module.sass";

type Props = {
	media: MediaRecord & { type: "MOVIE" | "SHORT" };
};

export function MovieMiniCard({ media }: Props) {
	const runtime = formatRuntime(media.movie.runtime);

	return (
		<MediaMiniCardShell media={media}>
			{runtime && <div className={styles.info}>{runtime}</div>}
		</MediaMiniCardShell>
	);
}
