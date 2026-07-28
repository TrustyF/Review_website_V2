import { MovieCard } from "@/components/media/media-card/cards/movie-card";
import { MediaRecord } from "@/components/media/media-card/types";

type Props = {
	media: MediaRecord;
	posterSrc: string;
	showEditButton?: boolean;
};

export function MediaCardResolver({
	media,
	posterSrc,
	showEditButton = true,
}: Props) {
	// Return the appropriate component depending on media type
	switch (media.type) {
		case "MOVIE":
		case "SHORT":
			return (
				<MovieCard
					media={media}
					posterSrc={posterSrc}
					showEditButton={showEditButton}
				/>
			);
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
