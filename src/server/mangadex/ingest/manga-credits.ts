import { MediaType, Prisma, Source } from "@prisma/client";
import { MangaDexManga } from "@/server/mangadex/schema";
import {
	resolveGenre,
	resolvePerson,
	resolveRole,
} from "@/server/resolvers/entity-resolver";
import { pickLocalized } from "@/server/mangadex/localized";

type t_client = Prisma.TransactionClient;

// Replaces a manga's genres and credits with the latest MangaDex data. Safe
// to call for a brand-new media row (nothing to delete/upsert over) or to
// re-sync an existing one on re-enrichment.
export async function syncMangaCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	manga: MangaDexManga,
) {
	await tx.credit.deleteMany({ where: { mediaId } });

	// MangaDex tags are grouped into genre/theme/format/content — only
	// "genre" maps to what this app's Genre model represents; theme/format/
	// content tags (e.g. "Award Winning", "Gore") would clutter it with
	// things that aren't really genres.
	for (const tag of manga.attributes.tags) {
		if (tag.attributes.group !== "genre") continue;
		const name = pickLocalized(tag.attributes.name);
		if (!name) continue;

		const genre = await resolveGenre(tx, name, MediaType.MANGA);
		await tx.mediaGenre.upsert({
			where: { mediaId_genreId: { mediaId, genreId: genre.id } },
			update: {},
			create: { mediaId, genreId: genre.id },
		});
	}

	// Author/artist credits — a person can be both (e.g. a mangaka drawing
	// their own story), which naturally becomes two separate Credit rows,
	// same as an actor who's also a movie's director.
	for (const r of manga.relationships) {
		if (r.type !== "author" && r.type !== "artist") continue;
		if (!r.attributes?.name) continue;

		const role = await resolveRole(
			tx,
			r.type === "author" ? "Author" : "Artist",
			MediaType.MANGA,
		);
		const person = await resolvePerson(
			tx,
			r.id,
			Source.MANGADEX,
			r.attributes.name,
		);
		await tx.credit.create({
			data: { mediaId, roleId: role.id, personId: person.id },
		});
	}
}
