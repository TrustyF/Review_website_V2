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
};

// The shape components actually want to work with
export type MediaRecord =
	| (BaseRecord & { type: "MOVIE"; movie: Movie })
	| (BaseRecord & { type: "SHORT"; movie: Movie })
	| (BaseRecord & { type: "TVSHOW"; tvShow: TvShow })
	| (BaseRecord & { type: "MANGA"; manga: Manga })
	| (BaseRecord & { type: "COMIC"; comic: Comic })
	| (BaseRecord & { type: "GAME"; game: Game });

export function toMediaRecord(raw: RawMediaRecord): MediaRecord | null {
	switch (raw.type) {
		case "MOVIE":
		case "SHORT":
			if (!raw.movie) return null;
			return { ...raw, type: raw.type, movie: raw.movie };
		case "TVSHOW":
			if (!raw.tvShow) return null;
			return { ...raw, type: raw.type, tvShow: raw.tvShow };
		case "MANGA":
			if (!raw.manga) return null;
			return { ...raw, type: raw.type, manga: raw.manga };
		case "COMIC":
			if (!raw.comic) return null;
			return { ...raw, type: raw.type, comic: raw.comic };
		case "GAME":
			if (!raw.game) return null;
			return { ...raw, type: raw.type, game: raw.game };
	}
}
