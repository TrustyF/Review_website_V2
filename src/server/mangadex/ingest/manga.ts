import {
	EnrichmentStatus,
	MediaStatus,
	MediaType,
	Prisma,
} from "@prisma/client";
import {
	MangaDexManga,
	MangaDexMangaResponse,
	MangaDexStatisticsEntry,
} from "@/server/mangadex/schema";
import { db } from "@/server/db/client";
import { resolveCountry } from "@/server/resolvers/entity-resolver";
import { syncMangaCreditsAndGenres } from "@/server/mangadex/ingest/manga-credits";
import {
	pickEnglishTitle,
	pickLocalized,
	pickNativeTitle,
} from "@/server/mangadex/localized";

type t_client = Prisma.TransactionClient;

// MangaDex only exposes original language (not a country), so origin
// country is a best-effort guess from it — covers the languages manga on
// the site is actually published in. Anything else is left unset rather
// than guessed at.
const LANGUAGE_TO_COUNTRY: Record<string, string> = {
	ja: "JP",
	ko: "KR",
	zh: "CN",
	"zh-hk": "HK",
	en: "US",
};

const STATUS_MAP: Record<string, MediaStatus> = {
	ongoing: MediaStatus.ONGOING,
	hiatus: MediaStatus.ONGOING,
	completed: MediaStatus.COMPLETED,
	cancelled: MediaStatus.COMPLETED,
};

// MangaDex's own four-tier content rating — the two most explicit tiers map
// to isAdult, same as TMDB's adult flag (see tmdb/ingest/movie.ts).
const ADULT_CONTENT_RATINGS = new Set(["erotica", "pornographic"]);

function extractCoverFileName(manga: MangaDexManga): string | null {
	const cover = manga.relationships.find((r) => r.type === "cover_art");
	return cover?.attributes?.fileName ?? null;
}

// MangaDex represents "unknown" as an empty string rather than omitting the
// field, and volume/chapter counts aren't always whole numbers ("10.5").
function parseCount(value: string | null): number | null {
	if (!value) return null;
	const n = Math.floor(Number(value));
	return Number.isFinite(n) ? n : null;
}

// existing is only passed by updateMangaFromMangaDex (undefined on create) —
// every field below except status/publicRating only fills in if existing
// doesn't already have a value, whether that's a prior ingest or a hand edit
// in the media editor.
async function buildMediaFields(
	tx: t_client,
	manga: MangaDexManga,
	statistics: MangaDexStatisticsEntry | null,
	existing?: {
		title: string;
		alternateTitle: string | null;
		overview: string | null;
		releaseDate: Date | null;
		posterPath: string | null;
		countryId: number | null;
	} | null,
) {
	const country = manga.attributes.originalLanguage
		? LANGUAGE_TO_COUNTRY[manga.attributes.originalLanguage]
		: null;

	const title =
		pickEnglishTitle(manga.attributes.title, manga.attributes.altTitles) ??
		"Untitled";

	return {
		title: existing?.title ?? title,
		alternateTitle:
			existing?.alternateTitle ??
			pickNativeTitle(manga.attributes.title, manga.attributes.altTitles, title),
		overview: existing?.overview ?? pickLocalized(manga.attributes.description),
		releaseDate:
			existing?.releaseDate ??
			(manga.attributes.year ? new Date(manga.attributes.year, 0, 1) : null),
		status: STATUS_MAP[manga.attributes.status] ?? MediaStatus.RELEASED,
		// Refreshed every re-enrich, not just filled in once — same reasoning
		// as publicRating just below (a source-reported fact, not editorial
		// content a hand edit should stick over).
		isAdult: ADULT_CONTENT_RATINGS.has(manga.attributes.contentRating ?? ""),
		publicRating: statistics?.rating.bayesian ?? null,
		posterPath: existing?.posterPath ?? extractCoverFileName(manga),
		countryId:
			existing?.countryId ??
			(country ? (await resolveCountry(tx, country)).id : null),
		sourceUrl: `https://mangadex.org/title/${manga.id}`,
	};
}

export async function addMangaFromMangaDex(
	response: MangaDexMangaResponse,
	statistics: MangaDexStatisticsEntry | null,
) {
	const manga = response.data;
	const externalId = manga.id;

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.MANGA },
		});
		if (existing) return existing;

		const media = await tx.media.create({
			data: {
				...(await buildMediaFields(tx, manga, statistics)),
				type: MediaType.MANGA,
				externalId,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				manga: {
					create: {
						volumeCount: parseCount(manga.attributes.lastVolume),
						chapterCount: parseCount(manga.attributes.lastChapter),
					},
				},
			},
		});

		await syncMangaCreditsAndGenres(tx, media.id, manga);

		return media;
	});
}

export async function updateMangaFromMangaDex(
	response: MangaDexMangaResponse,
	statistics: MangaDexStatisticsEntry | null,
) {
	const manga = response.data;
	const externalId = manga.id;

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.MANGA },
			include: { manga: true },
		});
		if (!existing)
			throw new Error(
				`updateMangaFromMangaDex: no manga found for externalId ${externalId}`,
			);

		await tx.media.update({
			where: { id: existing.id },
			data: {
				...(await buildMediaFields(tx, manga, statistics, existing)),
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				manga: {
					update: {
						volumeCount:
							existing.manga?.volumeCount ??
							parseCount(manga.attributes.lastVolume),
						chapterCount:
							existing.manga?.chapterCount ??
							parseCount(manga.attributes.lastChapter),
					},
				},
			},
		});

		await syncMangaCreditsAndGenres(tx, existing.id, manga);

		return existing;
	});
}
