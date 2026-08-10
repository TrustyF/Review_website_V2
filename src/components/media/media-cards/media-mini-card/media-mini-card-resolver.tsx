import { MovieMiniCard } from "@/components/media/media-cards/media-mini-card/movie-mini-card";
import { TvShowMiniCard } from "@/components/media/media-cards/media-mini-card/tv-show-mini-card";
import { MangaMiniCard } from "@/components/media/media-cards/media-mini-card/manga-mini-card";
import { ComicMiniCard } from "@/components/media/media-cards/media-mini-card/comic-mini-card";
import { GameMiniCard } from "@/components/media/media-cards/media-mini-card/game-mini-card";
import { BookMiniCard } from "@/components/media/media-cards/media-mini-card/book-mini-card";
import { MediaRecord } from "@/components/media/types";

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
		case "COMIC":
			return <ComicMiniCard media={media} />;
		case "GAME":
			return <GameMiniCard media={media} />;
		case "BOOK":
			return <BookMiniCard media={media} />;
		default:
			throw new Error(`Unhandled media type: ${JSON.stringify(media)}`);
	}
}
