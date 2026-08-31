import { MediaType, Prisma, Source } from "@prisma/client";
import { MangaDexManga } from "@/server/mangadex/schema";
import {
	resolveGenresBatch,
	resolvePeopleBatch,
	resolveRolesBatch,
} from "@/server/resolvers/batch-entity-resolver";
import { pickLocalized } from "@/server/mangadex/localized";

type t_client = Prisma.TransactionClient;

export async function syncMangaCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	manga: MangaDexManga,
) {
	await tx.credit.deleteMany({ where: { mediaId } });
	await tx.mediaGenre.deleteMany({ where: { mediaId } });

	// Only the "genre" tag group maps to this app's Genre model; theme/format/content tags would clutter it.
	const genreInputs = manga.attributes.tags
		.filter((tag) => tag.attributes.group === "genre")
		.map((tag) => pickLocalized(tag.attributes.name))
		.filter((name): name is string => !!name)
		.map((name) => ({ name, origin: MediaType.MANGA }));

	// A person can be both author and artist, which naturally becomes two separate Credit rows.
	const relationships = manga.relationships.filter(
		(r) => (r.type === "author" || r.type === "artist") && r.attributes?.name,
	);

	const roleInputs = [
		...(relationships.some((r) => r.type === "author")
			? [{ name: "Author", origin: MediaType.MANGA }]
			: []),
		...(relationships.some((r) => r.type === "artist")
			? [{ name: "Artist", origin: MediaType.MANGA }]
			: []),
	];
	const personInputs = relationships.map((r) => ({
		externalId: r.id,
		source: Source.MANGADEX,
		// Guaranteed by the filter above; the narrowing just doesn't survive into this separate .map().
		name: r.attributes!.name!,
	}));

	const genreMap = await resolveGenresBatch(tx, genreInputs);
	const roleMap = await resolveRolesBatch(tx, roleInputs);
	const personMap = await resolvePeopleBatch(tx, personInputs);

	const mediaGenreRows = genreInputs.map((g) => ({
		mediaId,
		genreId: genreMap.get(`${g.origin}:${g.name}`)!,
	}));

	const creditRows: Prisma.CreditCreateManyInput[] = relationships.map(
		(r) => ({
			mediaId,
			roleId: roleMap.get(
				`${MediaType.MANGA}:${r.type === "author" ? "Author" : "Artist"}`,
			)!,
			personId: personMap.get(`${Source.MANGADEX}:${r.id}`)!,
		}),
	);

	if (mediaGenreRows.length) {
		await tx.mediaGenre.createMany({ data: mediaGenreRows });
	}
	if (creditRows.length) {
		await tx.credit.createMany({ data: creditRows });
	}
}
