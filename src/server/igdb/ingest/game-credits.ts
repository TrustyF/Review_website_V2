import { MediaType, Prisma, Source } from "@prisma/client";
import { IgdbGame } from "@/server/igdb/schema";
import {
	resolveCompaniesBatch,
	resolveGenresBatch,
	resolveRolesBatch,
} from "@/server/resolvers/batch-entity-resolver";

type t_client = Prisma.TransactionClient;

// Replaces a game's genres and credits with the latest IGDB data. IGDB has
// no per-person credit data (no cast/crew), only companies — a studio can
// be both developer and publisher, which naturally becomes two Credit rows,
// same as an author who's also the artist for a manga.
//
// Batched — see movie-credits.ts's own comment and batch-entity-resolver.ts
// for why this collapses the whole item's references into a handful of
// findMany/createMany calls instead of one round trip per company.
export async function syncGameCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	game: IgdbGame,
) {
	await tx.credit.deleteMany({ where: { mediaId } });
	await tx.mediaGenre.deleteMany({ where: { mediaId } });

	const genreInputs = (game.genres ?? []).map((g) => ({
		name: g.name,
		origin: MediaType.GAME,
	}));

	const involvedCompanies = game.involved_companies ?? [];
	const roleInputs = [
		...(involvedCompanies.some((c) => c.developer)
			? [{ name: "Developer", origin: MediaType.GAME }]
			: []),
		...(involvedCompanies.some((c) => c.publisher)
			? [{ name: "Publisher", origin: MediaType.GAME }]
			: []),
	];
	const companyInputs = involvedCompanies.map((ic) => ({
		externalId: String(ic.company.id),
		source: Source.IGDB,
		name: ic.company.name,
		type: "studio",
	}));

	const genreMap = await resolveGenresBatch(tx, genreInputs);
	const roleMap = await resolveRolesBatch(tx, roleInputs);
	const companyMap = await resolveCompaniesBatch(tx, companyInputs);

	const mediaGenreRows = genreInputs.map((g) => ({
		mediaId,
		genreId: genreMap.get(`${g.origin}:${g.name}`)!,
	}));

	const developerRoleId = roleMap.get(`${MediaType.GAME}:Developer`);
	const publisherRoleId = roleMap.get(`${MediaType.GAME}:Publisher`);

	const creditRows: Prisma.CreditCreateManyInput[] = [];
	for (const ic of involvedCompanies) {
		const companyId = companyMap.get(`${Source.IGDB}:${ic.company.id}`)!;
		if (ic.developer) {
			creditRows.push({ mediaId, roleId: developerRoleId!, companyId });
		}
		if (ic.publisher) {
			creditRows.push({ mediaId, roleId: publisherRoleId!, companyId });
		}
	}

	if (mediaGenreRows.length) {
		await tx.mediaGenre.createMany({ data: mediaGenreRows });
	}
	if (creditRows.length) {
		await tx.credit.createMany({ data: creditRows });
	}
}
