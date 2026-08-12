import { MediaType, Prisma, Source } from "@prisma/client";
import { MangaDexManga } from "@/server/mangadex/schema";
import {
	resolveGenresBatch,
	resolvePeopleBatch,
	resolveRolesBatch,
} from "@/server/resolvers/batch-entity-resolver";
import { pickLocalized } from "@/server/mangadex/localized";

type t_client = Prisma.TransactionClient;

// Replaces a manga's genres and credits with the latest MangaDex data. Safe
// to call for a brand-new media row (nothing to delete/recreate over) or to
// re-sync an existing one on re-enrichment.
//
// Batched — see movie-credits.ts's own comment and batch-entity-resolver.ts
// for why this collapses the whole item's references into a handful of
// findMany/createMany calls instead of one round trip per tag/relationship.
export async function syncMangaCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	manga: MangaDexManga,
) {
	await tx.credit.deleteMany({ where: { mediaId } });
	await tx.mediaGenre.deleteMany({ where: { mediaId } });

	// MangaDex tags are grouped into genre/theme/format/content — only
	// "genre" maps to what this app's Genre model represents; theme/format/
	// content tags (e.g. "Award Winning", "Gore") would clutter it with
	// things that aren't really genres.
	const genreInputs = manga.attributes.tags
		.filter((tag) => tag.attributes.group === "genre")
		.map((tag) => pickLocalized(tag.attributes.name))
		.filter((name): name is string => !!name)
		.map((name) => ({ name, origin: MediaType.MANGA }));

	// Author/artist credits — a person can be both (e.g. a mangaka drawing
	// their own story), which naturally becomes two separate Credit rows,
	// same as an actor who's also a movie's director.
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
		// Guaranteed by the filter above — r.attributes?.name was checked
		// truthy there, but that narrowing doesn't survive into this
		// separate .map().
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
