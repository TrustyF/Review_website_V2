import { TmdbMovieResponse } from "@/lib/tmdb/request-schema";
import { db } from "@/lib/prisma/db";
import { MediaType } from "@prisma/client";
import {
	resolveCompany,
	resolveCountry,
	resolveGenre,
	resolvePerson,
	resolveRole,
} from "@/services/resolvers/entity-resolver";

export async function updateMovieFromTmdb(data: TmdbMovieResponse) {
	const externalId = String(data.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.MOVIE },
		});
		if (!existing)
			throw new Error(
				`updateMovieFromTmdb: no movie found for externalId ${externalId}`,
			);

		console.log(`attempting ${existing.title}`);

		const country = await resolveCountry(tx, data.origin_country?.[0]);

		await tx.media.update({
			where: { id: existing.id },
			data: {
				title: data.title,
				overview: data.overview,
				releaseDate: data.release_date ? new Date(data.release_date) : null,
				publicRating: data.vote_average,
				posterPath: data.poster_path,
				countryId: country.id,
				lastEnrichedAt: new Date(),
				enrichmentStatus: "DONE",
				movie: {
					update: {
						runtime: data.runtime,
						budget: data.budget,
						revenue: data.revenue,
						tagline: data.tagline,
						imdbID: data.imdb_id,
						originalLanguage: data.original_language,
					},
				},
			},
		});

		// genres
		for (const g of data.genres ?? []) {
			const genre = await resolveGenre(tx, g.name, MediaType.MOVIE);
			await tx.mediaGenre.upsert({
				where: { mediaId_genreId: { mediaId: existing.id, genreId: genre.id } },
				update: {},
				create: { mediaId: existing.id, genreId: genre.id },
			});
		}

		// Actors
		// Grab the actor role
		const actorRole = data.credits?.cast?.length
			? await resolveRole(tx, "Actor", MediaType.MOVIE)
			: null;
		for (const c of data.credits?.cast ?? []) {
			const person = await resolvePerson(tx, c.id, c.name);
			await tx.credit.create({
				data: {
					mediaId: existing.id,
					roleId: actorRole!.id,
					personId: person.id,
					order: c.order,
					character: c.character,
				},
			});
		}

		// Crew
		for (const c of data.credits?.crew ?? []) {
			const person = await resolvePerson(tx, c.id, c.name);
			const role = await resolveRole(tx, c.job, MediaType.MOVIE);
			await tx.credit.create({
				data: {
					mediaId: existing.id,
					roleId: role.id,
					personId: person.id,
				},
			});
		}

		// Studio
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
				data: {
					mediaId: existing.id,
					roleId: studioRole!.id,
					companyId: company.id,
				},
			});
		}

		return existing;
	});
}
