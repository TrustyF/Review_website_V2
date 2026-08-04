import { MediaType, Prisma, Source } from "@prisma/client";
import { TmdbTvResponse } from "@/server/tmdb/schema";
import {
	resolveCompany,
	resolveCountry,
	resolveGenre,
	resolvePerson,
	resolveRole,
} from "@/server/resolvers/entity-resolver";

type t_client = Prisma.TransactionClient;

// Replaces a TV show's genres and credits with the latest TMDB data. Safe to
// call for a brand-new media row (nothing to delete/upsert over) or to
// re-sync an existing one on re-enrichment.
export async function syncTvShowCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	data: TmdbTvResponse,
) {
	await tx.credit.deleteMany({ where: { mediaId } });

	for (const g of data.genres ?? []) {
		const genre = await resolveGenre(tx, g.name, MediaType.TVSHOW);
		await tx.mediaGenre.upsert({
			where: { mediaId_genreId: { mediaId, genreId: genre.id } },
			update: {},
			create: { mediaId, genreId: genre.id },
		});
	}

	// Cast credits
	const actorRole = data.credits?.cast?.length
		? await resolveRole(tx, "Actor", MediaType.TVSHOW)
		: null;
	for (const c of data.credits?.cast ?? []) {
		const person = await resolvePerson(tx, String(c.id), Source.TMDB, c.name);
		await tx.credit.create({
			data: {
				mediaId,
				roleId: actorRole!.id,
				personId: person.id,
				order: c.order,
				character: c.character,
			},
		});
	}

	// Crew credits (role name = job, e.g. "Director", "Creator")
	for (const c of data.credits?.crew ?? []) {
		const person = await resolvePerson(tx, String(c.id), Source.TMDB, c.name);
		const role = await resolveRole(tx, c.job, MediaType.TVSHOW);
		await tx.credit.create({
			data: { mediaId, roleId: role.id, personId: person.id },
		});
	}

	// Studio/network credits
	const studioRole = data.production_companies?.length
		? await resolveRole(tx, "Studio", MediaType.TVSHOW)
		: null;
	for (const co of data.production_companies ?? []) {
		const companyCountry = co.origin_country
			? await resolveCountry(tx, co.origin_country)
			: null;
		const company = await resolveCompany(
			tx,
			String(co.id),
			Source.TMDB,
			co.name,
			"studio",
			co.logo_path,
			companyCountry?.id ?? null,
		);
		await tx.credit.create({
			data: { mediaId, roleId: studioRole!.id, companyId: company.id },
		});
	}
}
