import { MediaMiniCardShell } from "@/components/media/media-cards/media-mini-card/media-mini-card-shell";
import { MediaRecord } from "@/components/media/types";
import styles from "./media-mini-card-shell.module.sass";
import { MediaTitle } from "@/components/media/primitives/title";

type Props = {
	media: MediaRecord & { type: "BOOK" };
};

export function BookMiniCard({ media }: Props) {
	return (
		<MediaMiniCardShell media={media}>
			<MediaTitle
				title={media.title}
				titleFr={media.titleFr}
				className={styles.title}
			/>
		</MediaMiniCardShell>
	);
}
