import {
	Book,
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
// asset-paths.ts directly (not poster-resolver.ts) — this type module is imported from many server actions' hot paths, so keeping sharp's native binary out of its dependency graph matters broadly.
import {
	BANNER_FORMAT,
	mediaAssetFilename,
	toPosterSrc,
} from "@/server/resolvers/asset-paths";

// Review as every query returns it — the draft columns are globally omitted in db/client.ts.
export type PublicReview = Omit<
	Review,
	"bodyDraft" | "bodyFrDraft" | "draftUpdatedAt"
>;

// What Prisma actually hands back — every relation still optional
export type RawMediaRecord = Media & {
	movie?: Movie | null;
	tvShow?: TvShow | null;
	manga?: Manga | null;
	comic?: Comic | null;
	game?: Game | null;
	book?: Book | null;
	review?: PublicReview | null;
	credits?: Credit[];
	mediaGenres?: (MediaGenre & { genre: Genre })[];
};

// The base record type we will fill out by media type
type BaseRecord = Omit<Media, "type"> & {
	review?: PublicReview | null;
	credits?: Credit[];
	// Empty when a caller's query didn't include mediaGenres — same "just absent" handling as credits above, not an error case.
	genres: string[];
	posterSrc: string;
	// Unlike posterSrc, no placeholder fallback — absent just means "don't render a banner section", not "show a stand-in image".
	bannerSrc: string | null;
	// Smaller pre-encoded variant for the mobile featured-review card, which never displays the banner wider than ~800px physical.
	bannerSrcMobile: string | null;
	// "Watched on" — Review.createDate itself, not a separate column, since saveReview now requires a rating to save at all. Still gated on rating as a defensive fallback for older rows.
	watchedDate: Date | null;
};

// The shape components actually want to work with
export type MediaRecord =
	| (BaseRecord & { type: "MOVIE"; movie: Movie })
	| (BaseRecord & { type: "SHORT"; movie: Movie })
	| (BaseRecord & { type: "TVSHOW"; tvShow: TvShow })
	| (BaseRecord & { type: "MANGA"; manga: Manga })
	| (BaseRecord & { type: "COMIC"; comic: Comic })
	| (BaseRecord & { type: "GAME"; game: Game })
	| (BaseRecord & { type: "BOOK"; book: Book });

type CardBase = Pick<
	MediaRecord,
	| "id"
	| "title"
	| "titleFr"
	| "posterSrc"
	| "externalId"
	| "releaseDate"
	| "watchedDate"
	| "genres"
> & {
	review?: Pick<Review, "rating" | "difficulty" | "liked" | "body"> | null;
};

// Only what media grids, mini cards and their filters/sorts read. A full MediaRecord is assignable to it; a card needing a new field adds it here.
export type MediaCardRecord =
	| (CardBase & { type: "MOVIE"; movie: Pick<Movie, "runtime"> })
	| (CardBase & { type: "SHORT"; movie: Pick<Movie, "runtime"> })
	| (CardBase & {
			type: "TVSHOW";
			tvShow: Pick<TvShow, "seasonCount" | "episodeCount">;
	  })
	| (CardBase & {
			type: "MANGA";
			manga: Pick<Manga, "volumeCount" | "chapterCount">;
	  })
	| (CardBase & {
			type: "COMIC";
			comic: Pick<Comic, "volumeCount" | "chapterCount">;
	  })
	| (CardBase & { type: "GAME"; game: Pick<Game, "platform"> })
	| (CardBase & { type: "BOOK"; book: Pick<Book, never> });

// Trims a server-side list before it's serialized to the client; /movies goes from ~2MB to ~330KB.
export function toMediaCardRecord(record: MediaRecord): MediaCardRecord {
	const { review } = record;
	const base: CardBase = {
		id: record.id,
		title: record.title,
		titleFr: record.titleFr,
		posterSrc: record.posterSrc,
		externalId: record.externalId,
		releaseDate: record.releaseDate,
		watchedDate: record.watchedDate,
		genres: record.genres,
		review: review
			? {
					rating: review.rating,
					difficulty: review.difficulty,
					liked: review.liked,
					body: review.body,
				}
			: null,
	};
	switch (record.type) {
		case "MOVIE":
		case "SHORT":
			return {
				...base,
				type: record.type,
				movie: { runtime: record.movie.runtime },
			};
		case "TVSHOW": {
			const { seasonCount, episodeCount } = record.tvShow;
			return {
				...base,
				type: record.type,
				tvShow: { seasonCount, episodeCount },
			};
		}
		case "MANGA": {
			const { volumeCount, chapterCount } = record.manga;
			return {
				...base,
				type: record.type,
				manga: { volumeCount, chapterCount },
			};
		}
		case "COMIC": {
			const { volumeCount, chapterCount } = record.comic;
			return {
				...base,
				type: record.type,
				comic: { volumeCount, chapterCount },
			};
		}
		case "GAME":
			return {
				...base,
				type: record.type,
				game: { platform: record.game.platform },
			};
		case "BOOK":
			return { ...base, type: record.type, book: {} };
	}
}

// Synchronous and I/O-free: posterSrc/bannerSrc point at /api/poster and /api/banner routes rather than a pre-resolved file, so reshaping a media list never blocks on downloading a single image. Each route resolves/caches lazily on actual request. Filename is content-addressed by posterPath/bannerPath, so the URL changes whenever the image does, making a long-lived immutable Cache-Control safe.
export function toMediaRecord(raw: RawMediaRecord): MediaRecord {
	const posterSrc = toPosterSrc(raw.id, raw.posterPath);
	const bannerSrc = raw.bannerPath
		? `/api/banner/${raw.id}/${mediaAssetFilename(raw.id, raw.bannerPath, BANNER_FORMAT)}`
		: null;
	const bannerSrcMobile = raw.bannerPath ? `${bannerSrc}?size=mobile` : null;
	const watchedDate = raw.review?.rating != null ? raw.review.createDate : null;
	// Flattened into genres; the raw relation itself isn't passed along.
	const { mediaGenres, ...base } = raw;
	const genres = (mediaGenres ?? []).map((mg) => mg.genre.name);
	switch (raw.type) {
		case "MOVIE":
		case "SHORT":
			if (!raw.movie) break;
			return {
				...base,
				type: raw.type,
				movie: raw.movie,
				posterSrc,
				bannerSrc,
				bannerSrcMobile,
				watchedDate,
				genres,
			};
		case "TVSHOW":
			if (!raw.tvShow) break;
			return {
				...base,
				type: raw.type,
				tvShow: raw.tvShow,
				posterSrc,
				bannerSrc,
				bannerSrcMobile,
				watchedDate,
				genres,
			};
		case "MANGA":
			if (!raw.manga) break;
			return {
				...base,
				type: raw.type,
				manga: raw.manga,
				posterSrc,
				bannerSrc,
				bannerSrcMobile,
				watchedDate,
				genres,
			};
		case "COMIC":
			if (!raw.comic) break;
			return {
				...base,
				type: raw.type,
				comic: raw.comic,
				posterSrc,
				bannerSrc,
				bannerSrcMobile,
				watchedDate,
				genres,
			};
		case "GAME":
			if (!raw.game) break;
			return {
				...base,
				type: raw.type,
				game: raw.game,
				posterSrc,
				bannerSrc,
				bannerSrcMobile,
				watchedDate,
				genres,
			};
		case "BOOK":
			if (!raw.book) break;
			return {
				...base,
				type: raw.type,
				book: raw.book,
				posterSrc,
				bannerSrc,
				bannerSrcMobile,
				watchedDate,
				genres,
			};
	}
	throw new Error(
		`Media ${raw.id} has type "${raw.type}" but its matching relation was not loaded or does not exist.`,
	);
}
