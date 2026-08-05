import { MovieCard } from "@/components/media/media-cards/media-card/movie-card";
import { TvShowCard } from "@/components/media/media-cards/media-card/tv-show-card";
import { MangaCard } from "@/components/media/media-cards/media-card/manga-card";
import { ComicCard } from "@/components/media/media-cards/media-card/comic-card";
import { GameCard } from "@/components/media/media-cards/media-card/game-card";
import { MediaRecord } from "@/components/media/types";

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
		case "COMIC":
			return <ComicCard media={media} />;
		case "GAME":
			return <GameCard media={media} />;
		default:
			throw new Error(`Unhandled media type: ${JSON.stringify(media)}`);
	}
}
