import { MediaCardShell } from "@/components/media/media-cards/media-card/media-card-shell";
import { MediaRecord } from "@/components/media/types";

type Props = {
	media: MediaRecord & { type: "BOOK" };
};

export function BookCard({ media }: Props) {
	return <MediaCardShell media={media} />;
}
