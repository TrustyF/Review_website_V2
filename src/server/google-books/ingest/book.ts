import { EnrichmentStatus, MediaStatus, MediaType } from "@prisma/client";
import { GoogleBooksVolume } from "@/server/google-books/schema";
import { db } from "@/server/db/client";
import { syncBookCreditsAndGenres } from "@/server/google-books/ingest/book-credits";

// publishedDate can be a bare year or a full ISO date; a bare year needs an explicit day-of-month
// or some engines treat it as a UTC date-time string, shifting the local date by a day.
function parsePublishedDate(
	publishedDate: string | null | undefined,
): Date | null {
	if (!publishedDate) return null;
	const date = /^\d{4}$/.test(publishedDate)
		? new Date(Number(publishedDate), 0, 1)
		: new Date(publishedDate);
	return Number.isNaN(date.getTime()) ? null : date;
}

// Upgrades http (blocked as mixed content) to https, and bumps the default zoom=1 (blurry ~128px)
// to zoom=3, the largest size Google Books serves. Exported for search-result thumbnails too.
export function upgradeToHttps(url: string): string {
	return url.replace(/^http:\/\//, "https://").replace(/([?&]zoom=)\d+/, "$13");
}

function buildOverview(volume: GoogleBooksVolume): string | null {
	return volume.volumeInfo.description ?? null;
}

// Fields other than status/publicRating only fill in if existing has no value, preserving prior ingests/hand edits.
function buildMediaFields(
	volume: GoogleBooksVolume,
	existing?: {
		title: string;
		overview: string | null;
		releaseDate: Date | null;
		posterPath: string | null;
		isAdult: boolean;
	} | null,
) {
	const thumbnail = volume.volumeInfo.imageLinks?.thumbnail;
	return {
		title: existing?.title ?? volume.volumeInfo.title,
		overview: existing?.overview ?? buildOverview(volume),
		releaseDate:
			existing?.releaseDate ??
			parsePublishedDate(volume.volumeInfo.publishedDate),
		// No ongoing/completed/cancelled signal — every tracked volume is treated as released.
		status: MediaStatus.RELEASED,
		// Source rating can turn this on but never off, so a manual correction always wins.
		isAdult:
			(existing?.isAdult ?? false) ||
			volume.volumeInfo.maturityRating === "MATURE",
		publicRating: null,
		posterPath:
			existing?.posterPath ?? (thumbnail ? upgradeToHttps(thumbnail) : null),
		sourceUrl:
			volume.volumeInfo.infoLink ??
			`https://books.google.com/books?id=${volume.id}`,
	};
}

export async function addBookFromGoogleBooks(volume: GoogleBooksVolume) {
	const externalId = volume.id;

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.BOOK },
		});
		if (existing) return existing;

		const media = await tx.media.create({
			data: {
				...buildMediaFields(volume),
				type: MediaType.BOOK,
				externalId,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				book: {
					create: {
						pageCount: volume.volumeInfo.pageCount ?? null,
						isbn:
							volume.volumeInfo.industryIdentifiers?.find(
								(i) => i.type === "ISBN_13",
							)?.identifier ??
							volume.volumeInfo.industryIdentifiers?.find(
								(i) => i.type === "ISBN_10",
							)?.identifier ??
							null,
					},
				},
			},
		});

		await syncBookCreditsAndGenres(tx, media.id, volume);

		return media;
	});
}

export async function updateBookFromGoogleBooks(volume: GoogleBooksVolume) {
	const externalId = volume.id;

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.BOOK },
			include: { book: true },
		});
		if (!existing)
			throw new Error(
				`updateBookFromGoogleBooks: no book found for externalId ${externalId}`,
			);

		await tx.media.update({
			where: { id: existing.id },
			data: {
				...buildMediaFields(volume, existing),
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				book: {
					update: {
						pageCount:
							existing.book?.pageCount ?? volume.volumeInfo.pageCount ?? null,
						isbn:
							existing.book?.isbn ??
							volume.volumeInfo.industryIdentifiers?.find(
								(i) => i.type === "ISBN_13",
							)?.identifier ??
							volume.volumeInfo.industryIdentifiers?.find(
								(i) => i.type === "ISBN_10",
							)?.identifier ??
							null,
					},
				},
			},
		});

		await syncBookCreditsAndGenres(tx, existing.id, volume);

		return existing;
	});
}
