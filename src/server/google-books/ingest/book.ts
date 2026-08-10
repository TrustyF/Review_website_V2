import { EnrichmentStatus, MediaStatus, MediaType } from "@prisma/client";
import { GoogleBooksVolume } from "@/server/google-books/schema";
import { db } from "@/server/db/client";
import { syncBookCreditsAndGenres } from "@/server/google-books/ingest/book-credits";

// publishedDate ranges from a bare year ("1997") to a full ISO date
// ("1997-06-01") depending on how well-cataloged the volume is — `new
// Date(...)` parses both fine, but a bare year needs an explicit day-of-month
// or it's treated as a full ISO date-time string in some engines.
function parsePublishedDate(publishedDate: string | null | undefined): Date | null {
	if (!publishedDate) return null;
	const date = /^\d{4}$/.test(publishedDate)
		? new Date(Number(publishedDate), 0, 1)
		: new Date(publishedDate);
	return Number.isNaN(date.getTime()) ? null : date;
}

// Google Books hands back imageLinks.thumbnail as http:// even when queried
// over https — browsers block that as mixed content on an https page, so it
// gets upgraded here before being stored as Media.posterPath. Exported for
// media-add-actions.ts's search-result thumbnails, which hit the same issue
// before a volume is ever imported.
export function upgradeToHttps(url: string): string {
	return url.replace(/^http:\/\//, "https://");
}

function buildOverview(volume: GoogleBooksVolume): string | null {
	return volume.volumeInfo.description ?? null;
}

// existing is only passed by updateBookFromGoogleBooks (undefined on create)
// — every field below except status/publicRating only fills in if existing
// doesn't already have a value, whether that's a prior ingest or a hand edit
// in the media editor.
function buildMediaFields(
	volume: GoogleBooksVolume,
	existing?: {
		title: string;
		overview: string | null;
		releaseDate: Date | null;
		posterPath: string | null;
	} | null,
) {
	const thumbnail = volume.volumeInfo.imageLinks?.thumbnail;
	return {
		title: existing?.title ?? volume.volumeInfo.title,
		overview: existing?.overview ?? buildOverview(volume),
		releaseDate:
			existing?.releaseDate ?? parsePublishedDate(volume.volumeInfo.publishedDate),
		// Google Books has no ongoing/completed/cancelled signal — every
		// tracked volume is treated as a released, standalone book.
		status: MediaStatus.RELEASED,
		publicRating: null,
		posterPath: existing?.posterPath ?? (thumbnail ? upgradeToHttps(thumbnail) : null),
		sourceUrl:
			volume.volumeInfo.infoLink ?? `https://books.google.com/books?id=${volume.id}`,
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
							existing.book?.pageCount ?? (volume.volumeInfo.pageCount ?? null),
						isbn:
							existing.book?.isbn ??
							(volume.volumeInfo.industryIdentifiers?.find(
								(i) => i.type === "ISBN_13",
							)?.identifier ??
								volume.volumeInfo.industryIdentifiers?.find(
									(i) => i.type === "ISBN_10",
								)?.identifier ??
								null),
					},
				},
			},
		});

		await syncBookCreditsAndGenres(tx, existing.id, volume);

		return existing;
	});
}
