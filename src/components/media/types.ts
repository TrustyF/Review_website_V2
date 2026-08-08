import {
	Comic,
	Credit,
	Game,
	Genre,
	Manga,
	Media,
	MediaGenre,
	Movie,
	Review,
	TvShow,
} from "@prisma/client";
import {
	BANNER_FORMAT,
	mediaAssetFilename,
} from "@/server/resolvers/poster-resolver";

// What Prisma actually hands back — every relation still optional
export type RawMediaRecord = Media & {
	movie?: Movie | null;
	tvShow?: TvShow | null;
	manga?: Manga | null;
	comic?: Comic | null;
	game?: Game | null;
	review?: Review | null;
	credits?: Credit[];
	mediaGenres?: (MediaGenre & { genre: Genre })[];
};

// The base record type we will fill out by media type
type BaseRecord = Omit<Media, "type"> & {
	review?: Review | null;
	credits?: Credit[];
	// Empty when a caller's query didn't bother including mediaGenres (dev
	// fixture pages, the manual-add flow, ...) — same "just absent" handling
	// as credits above, not an error case.
	genres: string[];
	posterSrc: string;
	// Unlike posterSrc, no placeholder fallback — most media has no banner
	// at all (only TMDB/IGDB have one), so absent just means "don't render
	// a banner section" rather than "show a stand-in image".
	bannerSrc: string | null;
	// "Watched on", shown on MediaReview — Review.createDate itself, not a
	// separate column (see saveReview): saveReview now requires a rating to
	// save at all, so createDate can never predate one — gated on rating
	// being present anyway as a defensive fallback for rows that existed
	// before that requirement did.
	watchedDate: Date | null;
};

// The shape components actually want to work with
export type MediaRecord =
	| (BaseRecord & { type: "MOVIE"; movie: Movie })
	| (BaseRecord & { type: "SHORT"; movie: Movie })
	| (BaseRecord & { type: "TVSHOW"; tvShow: TvShow })
	| (BaseRecord & { type: "MANGA"; manga: Manga })
	| (BaseRecord & { type: "COMIC"; comic: Comic })
	| (BaseRecord & { type: "GAME"; game: Game });

// Synchronous and I/O-free: posterSrc/bannerSrc point at the /api/poster and
// /api/banner routes rather than a pre-resolved local file, so reshaping a
// whole list of media never blocks on downloading (or even stat-ing) a
// single image. Each route does the actual resolve-or-download-and-cache
// lazily, the moment a browser actually requests that image — which for an
// off-screen card (thanks to next/image's default lazy loading) may be
// never. The filename segment is content-addressed by posterPath/bannerPath
// (see mediaAssetFilename), so the URL itself changes whenever the image
// does, making a long-lived immutable Cache-Control on those routes safe.
export function toMediaRecord(raw: RawMediaRecord): MediaRecord {
	const posterSrc = raw.posterPath
		? `/api/poster/${raw.id}/${mediaAssetFilename(raw.id, raw.posterPath)}`
		: "/posters/placeholder.jpg";
	const bannerSrc = raw.bannerPath
		? `/api/banner/${raw.id}/${mediaAssetFilename(raw.id, raw.bannerPath, BANNER_FORMAT)}`
		: null;
	const watchedDate =
		raw.review?.rating != null ? raw.review.createDate : null;
	const genres = (raw.mediaGenres ?? []).map((mg) => mg.genre.name);
	switch (raw.type) {
		case "MOVIE":
		case "SHORT":
			if (!raw.movie) break;
			return {
				...raw,
				type: raw.type,
				movie: raw.movie,
				posterSrc,
				bannerSrc,
				watchedDate,
				genres,
			};
		case "TVSHOW":
			if (!raw.tvShow) break;
			return {
				...raw,
				type: raw.type,
				tvShow: raw.tvShow,
				posterSrc,
				bannerSrc,
				watchedDate,
				genres,
			};
		case "MANGA":
			if (!raw.manga) break;
			return {
				...raw,
				type: raw.type,
				manga: raw.manga,
				posterSrc,
				bannerSrc,
				watchedDate,
				genres,
			};
		case "COMIC":
			if (!raw.comic) break;
			return {
				...raw,
				type: raw.type,
				comic: raw.comic,
				posterSrc,
				bannerSrc,
				watchedDate,
				genres,
			};
		case "GAME":
			if (!raw.game) break;
			return {
				...raw,
				type: raw.type,
				game: raw.game,
				posterSrc,
				bannerSrc,
				watchedDate,
				genres,
			};
	}
	throw new Error(
		`Media ${raw.id} has type "${raw.type}" but its matching relation was not loaded or does not exist.`,
	);
}
