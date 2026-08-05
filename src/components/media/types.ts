import {
	Comic,
	Credit,
	Game,
	Manga,
	Media,
	Movie,
	Review,
	TvShow,
} from "@prisma/client";
import { posterFilename } from "@/server/resolvers/poster-resolver";

// What Prisma actually hands back — every relation still optional
export type RawMediaRecord = Media & {
	movie?: Movie | null;
	tvShow?: TvShow | null;
	manga?: Manga | null;
	comic?: Comic | null;
	game?: Game | null;
	review?: Review | null;
	credits?: Credit[];
};

// The base record type we will fill out by media type
type BaseRecord = Omit<Media, "type"> & {
	review?: Review | null;
	credits?: Credit[];
	posterSrc: string;
};

// The shape components actually want to work with
export type MediaRecord =
	| (BaseRecord & { type: "MOVIE"; movie: Movie })
	| (BaseRecord & { type: "SHORT"; movie: Movie })
	| (BaseRecord & { type: "TVSHOW"; tvShow: TvShow })
	| (BaseRecord & { type: "MANGA"; manga: Manga })
	| (BaseRecord & { type: "COMIC"; comic: Comic })
	| (BaseRecord & { type: "GAME"; game: Game });

// Synchronous and I/O-free: posterSrc points at the /api/poster route
// rather than a pre-resolved local file, so reshaping a whole list of media
// never blocks on downloading (or even stat-ing) a single poster. The route
// does the actual resolve-or-download-and-cache lazily, the moment a
// browser actually requests that image — which for an off-screen card
// (thanks to next/image's default lazy loading) may be never. The filename
// segment is content-addressed by posterPath (see posterFilename), so the
// URL itself changes whenever the poster does, making a long-lived
// immutable Cache-Control on that route safe.
export function toMediaRecord(raw: RawMediaRecord): MediaRecord {
	const posterSrc = raw.posterPath
		? `/api/poster/${raw.id}/${posterFilename(raw.id, raw.posterPath)}`
		: "/posters/placeholder.jpg";
	switch (raw.type) {
		case "MOVIE":
		case "SHORT":
			if (!raw.movie) break;
			return { ...raw, type: raw.type, movie: raw.movie, posterSrc };
		case "TVSHOW":
			if (!raw.tvShow) break;
			return { ...raw, type: raw.type, tvShow: raw.tvShow, posterSrc };
		case "MANGA":
			if (!raw.manga) break;
			return { ...raw, type: raw.type, manga: raw.manga, posterSrc };
		case "COMIC":
			if (!raw.comic) break;
			return { ...raw, type: raw.type, comic: raw.comic, posterSrc };
		case "GAME":
			if (!raw.game) break;
			return { ...raw, type: raw.type, game: raw.game, posterSrc };
	}
	throw new Error(
		`Media ${raw.id} has type "${raw.type}" but its matching relation was not loaded or does not exist.`,
	);
}
