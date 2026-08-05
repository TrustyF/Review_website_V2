import { MediaMiniCardShell } from "@/components/media/media-cards/media-mini-card/media-mini-card-shell";
import { formatRuntime } from "@/components/media/primitives/runtime";
import { MediaRecord } from "@/components/media/types";
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
