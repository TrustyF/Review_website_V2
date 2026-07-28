import { MediaCardShell } from "@/components/media/media-card/cards/media-card-shell";
import { MediaRuntime } from "@/components/media/media-card/primitives/runtime";
import { MediaRecord } from "@/components/media/media-card/types";

type Props = {
	media: MediaRecord & { type: "MOVIE" | "SHORT" };
};

export function MovieCard({ media }: Props) {
	return (
		<MediaCardShell media={media}>
			<MediaRuntime runtime={media.movie.runtime} />
		</MediaCardShell>
	);
}
