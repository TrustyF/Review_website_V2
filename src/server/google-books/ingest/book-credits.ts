import { MediaType, Prisma, Source } from "@prisma/client";
import { GoogleBooksVolume } from "@/server/google-books/schema";
import {
	resolveCompaniesBatch,
	resolveGenresBatch,
	resolvePeopleBatch,
	resolveRolesBatch,
} from "@/server/resolvers/batch-entity-resolver";

type t_client = Prisma.TransactionClient;

// Replaces a book's genres and credits with the latest Google Books data.
// Authors have no per-person id at all in this API (just plain name
// strings), unlike TMDB/ComicVine's numeric person ids — so a book's authors
// are deduped by name within Source.GOOGLE_BOOKS rather than a real external
// id, same tradeoff MangaDex credits made for its own nameless contributors.
// Same for the publisher's externalId.
//
// Batched — see movie-credits.ts's own comment and batch-entity-resolver.ts
// for why this collapses the whole item's references into a handful of
// findMany/createMany calls instead of one round trip per author.
export async function syncBookCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	volume: GoogleBooksVolume,
) {
	await tx.credit.deleteMany({ where: { mediaId } });
	await tx.mediaGenre.deleteMany({ where: { mediaId } });

	const genreInputs = (volume.volumeInfo.categories ?? []).map((category) => ({
		name: category,
		origin: MediaType.BOOK,
	}));

	const authors = volume.volumeInfo.authors ?? [];
	const publisher = volume.volumeInfo.publisher;

	const roleInputs = [
		...(authors.length ? [{ name: "Author", origin: MediaType.BOOK }] : []),
		...(publisher ? [{ name: "Publisher", origin: MediaType.BOOK }] : []),
	];
	const personInputs = authors.map((name) => ({
		externalId: name,
		source: Source.GOOGLE_BOOKS,
		name,
	}));
	const companyInputs = publisher
		? [
				{
					externalId: publisher,
					source: Source.GOOGLE_BOOKS,
					name: publisher,
					type: "publisher",
				},
			]
		: [];

	const genreMap = await resolveGenresBatch(tx, genreInputs);
	const roleMap = await resolveRolesBatch(tx, roleInputs);
	const personMap = await resolvePeopleBatch(tx, personInputs);
	const companyMap = await resolveCompaniesBatch(tx, companyInputs);

	const mediaGenreRows = genreInputs.map((g) => ({
		mediaId,
		genreId: genreMap.get(`${g.origin}:${g.name}`)!,
	}));

	const creditRows: Prisma.CreditCreateManyInput[] = [];

	if (authors.length) {
		const authorRoleId = roleMap.get(`${MediaType.BOOK}:Author`)!;
		for (const name of authors) {
			creditRows.push({
				mediaId,
				roleId: authorRoleId,
				personId: personMap.get(`${Source.GOOGLE_BOOKS}:${name}`)!,
			});
		}
	}

	if (publisher) {
		creditRows.push({
			mediaId,
			roleId: roleMap.get(`${MediaType.BOOK}:Publisher`)!,
			companyId: companyMap.get(`${Source.GOOGLE_BOOKS}:${publisher}`)!,
		});
	}

	if (mediaGenreRows.length) {
		await tx.mediaGenre.createMany({ data: mediaGenreRows });
	}
	if (creditRows.length) {
		await tx.credit.createMany({ data: creditRows });
	}
}
