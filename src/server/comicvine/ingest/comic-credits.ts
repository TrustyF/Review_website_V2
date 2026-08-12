import { MediaType, Prisma, Source } from "@prisma/client";
import { ComicVineVolume } from "@/server/comicvine/schema";
import {
	resolveCompaniesBatch,
	resolvePeopleBatch,
	resolveRolesBatch,
} from "@/server/resolvers/batch-entity-resolver";

type t_client = Prisma.TransactionClient;

// Replaces a comic's credits with the latest ComicVine data. ComicVine has
// no genre data on a volume (unlike TMDB/MangaDex/Google Books), so this
// only handles credits — no mediaGenre delete/insert here at all. The
// people list is flat with no per-person role breakdown at the volume level
// (that only exists per-issue), so every person gets a single generic
// "Creator" role rather than a guessed-at Writer/Artist split.
//
// Batched — see movie-credits.ts's own comment and batch-entity-resolver.ts
// for why this collapses the whole item's references into a handful of
// findMany/createMany calls instead of one round trip per person.
export async function syncComicCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	volume: ComicVineVolume,
) {
	await tx.credit.deleteMany({ where: { mediaId } });

	const roleInputs = [
		...(volume.publisher ? [{ name: "Publisher", origin: MediaType.COMIC }] : []),
		...(volume.people?.length
			? [{ name: "Creator", origin: MediaType.COMIC }]
			: []),
	];
	const companyInputs = volume.publisher
		? [
				{
					externalId: String(volume.publisher.id),
					source: Source.COMIC_VINE,
					name: volume.publisher.name,
					type: "publisher",
				},
			]
		: [];
	const personInputs = (volume.people ?? []).map((p) => ({
		externalId: String(p.id),
		source: Source.COMIC_VINE,
		name: p.name,
	}));

	const roleMap = await resolveRolesBatch(tx, roleInputs);
	const companyMap = await resolveCompaniesBatch(tx, companyInputs);
	const personMap = await resolvePeopleBatch(tx, personInputs);

	const creditRows: Prisma.CreditCreateManyInput[] = [];

	if (volume.publisher) {
		creditRows.push({
			mediaId,
			roleId: roleMap.get(`${MediaType.COMIC}:Publisher`)!,
			companyId: companyMap.get(`${Source.COMIC_VINE}:${volume.publisher.id}`)!,
		});
	}

	if (volume.people?.length) {
		const creatorRoleId = roleMap.get(`${MediaType.COMIC}:Creator`)!;
		for (const p of volume.people) {
			creditRows.push({
				mediaId,
				roleId: creatorRoleId,
				personId: personMap.get(`${Source.COMIC_VINE}:${p.id}`)!,
			});
		}
	}

	if (creditRows.length) {
		await tx.credit.createMany({ data: creditRows });
	}
}
