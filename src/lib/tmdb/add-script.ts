import { MediaType } from '@prisma/client'
import { TmdbMovieResponse } from '@/lib/tmdb/request-schema'
import { db } from '@/lib/prisma/db'
import {
  resolveCompany,
  resolveCountry,
  resolveGenre,
  resolvePerson,
  resolveRole,
} from '@/services/resolvers/entity-resolver'

export async function addMovieFromTmdb(data: TmdbMovieResponse) {
  const externalId = String(data.id)

  return db.$transaction(async (tx) => {
    // check existing
    const existing = await tx.media.findFirst({
      where: { externalId, type: MediaType.MOVIE },
    })
    if (existing) return existing

    // lookup country
    const country = await resolveCountry(tx, data.origin_country?.[0])
    const countryId = country?.id ?? null
    // Create media
    const media = await tx.media.create({
      data: {
        title: data.title,
        type: MediaType.MOVIE,
        overview: data.overview,
        externalId,
        releaseDate: data.release_date ? new Date(data.release_date) : null,
        publicRating: data.vote_average,
        countryId,
        movie: {
          create: {
            runtime: data.runtime ?? 0,
            budget: data.budget,
            revenue: data.revenue,
            tagline: data.tagline,
            imdbID: data.imdb_id,
            originalLanguage: data.original_language,
          },
        },
      },
    })

    // Genres
    for (const g of data.genres ?? []) {
      const genre = await resolveGenre(tx, g.name, MediaType.MOVIE)
      await tx.mediaGenre.create({
        data: { mediaId: media.id, genreId: genre.id },
      })
    }

    // Cast credits
    const actorRole = data.credits?.cast?.length ? await resolveRole(tx, 'Actor', MediaType.MOVIE) : null
    for (const c of data.credits?.cast ?? []) {
      const person = await resolvePerson(tx, c.id, c.name)
      await tx.credit.create({
        data: {
          mediaId: media.id,
          roleId: actorRole!.id,
          personId: person.id,
          order: c.order,
          character: c.character,
        },
      })
    }

    // Crew credits (role name = job, e.g. "Director", "Screenplay")
    for (const c of data.credits?.crew ?? []) {
      const person = await resolvePerson(tx, c.id, c.name)
      const role = await resolveRole(tx, c.job, MediaType.MOVIE)
      await tx.credit.create({
        data: { mediaId: media.id, roleId: role.id, personId: person.id },
      })
    }

    // Studio credits
    const studioRole = data.production_companies?.length ? await resolveRole(tx, 'Studio', MediaType.MOVIE) : null
    for (const co of data.production_companies ?? []) {
      const companyCountry = await resolveCountry(tx, co.origin_country)
      const companyCountryId = companyCountry?.id ?? null

      const company = await resolveCompany(tx, co.id, co.name, 'studio', co.logo_path, companyCountryId)
      await tx.credit.create({
        data: { mediaId: media.id, roleId: studioRole!.id, companyId: company.id },
      })
    }

    return media
  })
}
