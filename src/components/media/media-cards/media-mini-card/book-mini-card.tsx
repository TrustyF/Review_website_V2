import { MediaMiniCardShell } from "@/components/media/media-cards/media-mini-card/media-mini-card-shell";
import { MediaRecord } from "@/components/media/types";

type Props = {
	media: MediaRecord & { type: "BOOK" };
};

export function BookMiniCard({ media }: Props) {
	return <MediaMiniCardShell media={media} />;
}
