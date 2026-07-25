import { MovieCard } from "@/components/media/cards/movie-card";
import { MediaRecord } from "@/components/media/types";

export function MediaCardResolver({ media }: { media: MediaRecord }) {
	// Return the appropriate component depending on media type
	switch (media.type) {
		case "MOVIE":
		case "SHORT":
			return <MovieCard media={media} />;
		// case "TVSHOW":
		// 	return <TvShowCard media={media} />;
		// case "MANGA":
		// 	return <MangaCard media={media} />;
		// case "COMIC":
		// 	return <ComicCard media={media} />;
		// case "GAME":
		// 	return <GameCard media={media} />;
		default:
			throw new Error(`Unhandled media type: ${JSON.stringify(media)}`);
	}
}
