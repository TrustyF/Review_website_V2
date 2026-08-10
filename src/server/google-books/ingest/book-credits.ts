import { MediaType, Prisma, Source } from "@prisma/client";
import { GoogleBooksVolume } from "@/server/google-books/schema";
import {
	resolveCompany,
	resolveGenre,
	resolvePerson,
	resolveRole,
} from "@/server/resolvers/entity-resolver";

type t_client = Prisma.TransactionClient;

// Replaces a book's genres and credits with the latest Google Books data.
// Authors have no per-person id at all in this API (just plain name
// strings), unlike TMDB/ComicVine's numeric person ids — so a book's authors
// are deduped by name within Source.GOOGLE_BOOKS rather than a real external
// id, same tradeoff MangaDex credits made for its own nameless contributors.
export async function syncBookCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	volume: GoogleBooksVolume,
) {
	await tx.credit.deleteMany({ where: { mediaId } });

	for (const category of volume.volumeInfo.categories ?? []) {
		const genre = await resolveGenre(tx, category, MediaType.BOOK);
		await tx.mediaGenre.upsert({
			where: { mediaId_genreId: { mediaId, genreId: genre.id } },
			update: {},
			create: { mediaId, genreId: genre.id },
		});
	}

	if (volume.volumeInfo.authors?.length) {
		const authorRole = await resolveRole(tx, "Author", MediaType.BOOK);
		for (const name of volume.volumeInfo.authors) {
			const person = await resolvePerson(tx, name, Source.GOOGLE_BOOKS, name);
			await tx.credit.create({
				data: { mediaId, roleId: authorRole.id, personId: person.id },
			});
		}
	}

	if (volume.volumeInfo.publisher) {
		const publisherRole = await resolveRole(tx, "Publisher", MediaType.BOOK);
		const company = await resolveCompany(
			tx,
			volume.volumeInfo.publisher,
			Source.GOOGLE_BOOKS,
			volume.volumeInfo.publisher,
			"publisher",
		);
		await tx.credit.create({
			data: { mediaId, roleId: publisherRole.id, companyId: company.id },
		});
	}
}
