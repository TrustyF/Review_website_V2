import { MovieCard } from "@/components/media/media-card/cards/movie-card";
import { TvShowCard } from "@/components/media/media-card/cards/tv-show-card";
import { MangaCard } from "@/components/media/media-card/cards/manga-card";
import { GameCard } from "@/components/media/media-card/cards/game-card";
import { MediaRecord } from "@/components/media/media-card/types";

type Props = {
	media: MediaRecord;
};

export function MediaCardResolver({ media }: Props) {
	// Return the appropriate component depending on media type
	switch (media.type) {
		case "MOVIE":
		case "SHORT":
			return <MovieCard media={media} />;
		case "TVSHOW":
			return <TvShowCard media={media} />;
		case "MANGA":
			return <MangaCard media={media} />;
		// case "COMIC":
		// 	return <ComicCard media={media} />;
		case "GAME":
			return <GameCard media={media} />;
		default:
			throw new Error(`Unhandled media type: ${JSON.stringify(media)}`);
	}
}
