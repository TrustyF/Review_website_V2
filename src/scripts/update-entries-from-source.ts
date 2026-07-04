import { db } from '@/lib/db'
import { Media } from '@prisma/client'
import { resolveCountry } from '@/services/resolvers/entity-resolver'
import { TMDBMovie, TMDBMovieResponse } from '@/app/types/tmdb'

async function request_tmdb(media: Media): Promise<TMDBMovie> {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${media.externalId}`, {
    headers: new Headers({
      Accept: 'application/json',
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN!}`,
    }),
  })
  if (!res.ok) {
    throw new Error(`TMDB request failed: ${res.status}`)
  }
  const data = (await res.json()) as TMDBMovieResponse

  // check country
  const countries = data.origin_country ?? []
  const firstCountry = countries[0]
  if (!firstCountry) throw new Error('No countries found in request')

  // check production
  const prod = data.production_companies ?? []
  if (!prod.length) throw new Error('No production found in request')
  const productionCompanies = prod.map((c) => ({
    name: c.name,
    logoPath: c.logo_path,
    externalId: c.id,
    originCountry: c.origin_country,
  }))

  return {
    budget: data.budget ?? null,
    revenue: data.revenue ?? null,
    tagline: data.tagline ?? null,
    imdb_id: data.imdb_id ?? null,
    origin_country: firstCountry,
    production_companies: productionCompanies,
  }
}

async function update_movie(media: Media, r: TMDBMovie) {
  // find country
  const country = await resolveCountry(r.origin_country)
  // find country for company
  const companies = await Promise.all(
    r.production_companies.map(async (c) => ({
      ...c,
      country: await resolveCountry(c.originCountry),
    })),
  )

  try {
    await db.media.update({
      where: { id: media.id },
      data: {
        countryId: country.id,
        movie: {
          update: {
            budget: r.budget,
            revenue: r.revenue,
            tagline: r.tagline,
            imdbID: r.imdb_id,
          },
        },

        enrichmentStatus: 'DONE',
        lastEnrichedAt: new Date(),
      },
    })
  } catch (e) {
    console.log(e)
    await db.media.update({
      where: { id: media.id },
      data: {
        enrichmentStatus: 'FAILED',
      },
    })
  }
}

async function main() {
  // fetch media
  const mediaList = await db.media.findMany({
    where: { enrichmentStatus: 'PENDING' },
    take: 1,
  })
  // loop
  for (const media of mediaList) {
    if (media.type == 'MOVIE') {
      const data = await request_tmdb(media)
      await update_movie(media, data)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
