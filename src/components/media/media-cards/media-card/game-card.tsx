import { MediaCardShell } from "@/components/media/media-cards/media-card/media-card-shell";
import { MediaPlatform } from "@/components/media/primitives/platform";
import { MediaRecord } from "@/components/media/types";

type Props = {
	media: MediaRecord & { type: "GAME" };
};

export function GameCard({ media }: Props) {
	return (
		<MediaCardShell media={media}>
			{/*<MediaPlatform platform={media.game.platform} />*/}
		</MediaCardShell>
	);
}
