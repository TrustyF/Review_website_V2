import { MovieMiniCard } from "@/components/media/media-card/cards-mini/movie-mini-card";
import { TvShowMiniCard } from "@/components/media/media-card/cards-mini/tv-show-mini-card";
import { MangaMiniCard } from "@/components/media/media-card/cards-mini/manga-mini-card";
import { GameMiniCard } from "@/components/media/media-card/cards-mini/game-mini-card";
import { MediaRecord } from "@/components/media/media-card/types";

type Props = {
	media: MediaRecord;
};

export function MediaMiniCardResolver({ media }: Props) {
	// Return the appropriate component depending on media type
	switch (media.type) {
		case "MOVIE":
		case "SHORT":
			return <MovieMiniCard media={media} />;
		case "TVSHOW":
			return <TvShowMiniCard media={media} />;
		case "MANGA":
			return <MangaMiniCard media={media} />;
		case "GAME":
			return <GameMiniCard media={media} />;
		default:
			throw new Error(`Unhandled media type: ${JSON.stringify(media)}`);
	}
}
