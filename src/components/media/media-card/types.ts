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
import { resolvePoster } from "@/server/resolvers/poster-resolver";

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

// Async — resolves (and lazily caches) the poster alongside reshaping the
// record, so every caller gets a fully display-ready record from one call.
export async function toMediaRecord(raw: RawMediaRecord): Promise<MediaRecord> {
	const posterSrc = await resolvePoster(
		raw.id,
		raw.type,
		raw.externalId,
		raw.posterPath,
	);
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
