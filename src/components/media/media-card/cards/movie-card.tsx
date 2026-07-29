import { MediaCardShell } from "@/components/media/media-card/cards/media-card-shell";
import { MediaRuntime } from "@/components/media/media-card/primitives/runtime";
import { MediaRecord } from "@/components/media/media-card/types";
import { CircularGauge } from "@/components/ui/circular-gauge";

type Props = {
	media: MediaRecord & { type: "MOVIE" | "SHORT" };
};

export function MovieCard({ media }: Props) {
	const { budget, revenue } = media.movie;
	const roi = budget && revenue ? ((revenue - budget) / budget) * 100 : null;

	return (
		<MediaCardShell media={media}>
			<MediaRuntime runtime={media.movie.runtime} />
			{roi !== null && (
				<CircularGauge
					value={roi}
					size={40}
					strokeWidth={3}
					unit="%"
				/>
			)}
		</MediaCardShell>
	);
}
