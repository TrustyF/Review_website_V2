import { MediaType, Prisma, Source } from "@prisma/client";
import { ComicVineVolume } from "@/server/comicvine/schema";
import {
	resolveCompaniesBatch,
	resolvePeopleBatch,
	resolveRolesBatch,
} from "@/server/resolvers/batch-entity-resolver";

type t_client = Prisma.TransactionClient;

// ComicVine has no volume-level genre data, so only credits are synced here.
// The people list is flat (no per-person role until issue level), so everyone gets a generic "Creator" role.
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
