import { MediaMiniCardShell } from "@/components/media/media-mini-card/media-mini-card-shell";
import { formatPlatformSummary } from "@/components/media/primitives/platform";
import { MediaRecord } from "@/components/media/types";
import styles from "./media-mini-card-shell.module.sass";

type Props = {
	media: MediaRecord & { type: "GAME" };
};

export function GameMiniCard({ media }: Props) {
	const platform = formatPlatformSummary(media.game.platform);

	return (
		<MediaMiniCardShell media={media}>
			{/*{platform && <div className={styles.info}>{platform}</div>}*/}
		</MediaMiniCardShell>
	);
}
