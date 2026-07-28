import { MediaType, Prisma } from "@prisma/client";
import { TmdbMovieResponse } from "@/server/tmdb/schema";
import {
	resolveCompany,
	resolveCountry,
	resolveGenre,
	resolvePerson,
	resolveRole,
} from "@/server/resolvers/entity-resolver";

type t_client = Prisma.TransactionClient;

// Replaces a movie's genres and credits with the latest TMDB data. Safe to
// call for a brand-new media row (nothing to delete/upsert over) or to
// re-sync an existing one on re-enrichment.
export async function syncMovieCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	data: TmdbMovieResponse,
) {
	await tx.credit.deleteMany({ where: { mediaId } });

	for (const g of data.genres ?? []) {
		const genre = await resolveGenre(tx, g.name, MediaType.MOVIE);
		await tx.mediaGenre.upsert({
			where: { mediaId_genreId: { mediaId, genreId: genre.id } },
			update: {},
			create: { mediaId, genreId: genre.id },
		});
	}

	// Cast credits
	const actorRole = data.credits?.cast?.length
		? await resolveRole(tx, "Actor", MediaType.MOVIE)
		: null;
	for (const c of data.credits?.cast ?? []) {
		const person = await resolvePerson(tx, c.id, c.name);
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

	// Crew credits (role name = job, e.g. "Director", "Screenplay")
	for (const c of data.credits?.crew ?? []) {
		const person = await resolvePerson(tx, c.id, c.name);
		const role = await resolveRole(tx, c.job, MediaType.MOVIE);
		await tx.credit.create({
			data: { mediaId, roleId: role.id, personId: person.id },
		});
	}

	// Studio credits
	const studioRole = data.production_companies?.length
		? await resolveRole(tx, "Studio", MediaType.MOVIE)
		: null;
	for (const co of data.production_companies ?? []) {
		const companyCountry = co.origin_country
			? await resolveCountry(tx, co.origin_country)
			: null;
		const company = await resolveCompany(
			tx,
			co.id,
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
