import { MediaType, Prisma, Source } from "@prisma/client";
import { IgdbGame } from "@/server/igdb/schema";
import {
	resolveCompany,
	resolveGenre,
	resolveRole,
} from "@/server/resolvers/entity-resolver";

type t_client = Prisma.TransactionClient;

// Replaces a game's genres and credits with the latest IGDB data. IGDB has
// no per-person credit data (no cast/crew), only companies — a studio can
// be both developer and publisher, which naturally becomes two Credit rows,
// same as an author who's also the artist for a manga.
export async function syncGameCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	game: IgdbGame,
) {
	await tx.credit.deleteMany({ where: { mediaId } });

	for (const g of game.genres ?? []) {
		const genre = await resolveGenre(tx, g.name, MediaType.GAME);
		await tx.mediaGenre.upsert({
			where: { mediaId_genreId: { mediaId, genreId: genre.id } },
			update: {},
			create: { mediaId, genreId: genre.id },
		});
	}

	const developerRole = game.involved_companies?.some((c) => c.developer)
		? await resolveRole(tx, "Developer", MediaType.GAME)
		: null;
	const publisherRole = game.involved_companies?.some((c) => c.publisher)
		? await resolveRole(tx, "Publisher", MediaType.GAME)
		: null;

	for (const ic of game.involved_companies ?? []) {
		const company = await resolveCompany(
			tx,
			String(ic.company.id),
			Source.IGDB,
			ic.company.name,
			"studio",
		);

		if (ic.developer) {
			await tx.credit.create({
				data: { mediaId, roleId: developerRole!.id, companyId: company.id },
			});
		}
		if (ic.publisher) {
			await tx.credit.create({
				data: { mediaId, roleId: publisherRole!.id, companyId: company.id },
			});
		}
	}
}
