import { MediaCardShell } from "@/components/media/media-card/cards/media-card-shell";
import { MediaPlatform } from "@/components/media/media-card/primitives/platform";
import { MediaRecord } from "@/components/media/media-card/types";

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
