// migrate.ts
import mysql, { RowDataPacket } from 'mysql2/promise'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'
import { MediaType } from '@prisma/client'

const mediaTypeMap: Record<string, MediaType> = {
  movie: MediaType.MOVIE,
  short: MediaType.SHORT,
  tv: MediaType.TVSHOW,
  manga: MediaType.MANGA,
  comic: MediaType.COMIC,
  game: MediaType.GAME,
}

export function toMediaType(value: string): MediaType | undefined {
  const mapped = mediaTypeMap[value.toLowerCase().trim()]
  if (!mapped) {
    console.log(`Unknown media type: ${value}`)
    return undefined
  }
  return mapped
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const db = new PrismaClient({ adapter })

// Shape of a row coming out of the OLD schema
interface LegacyUserRow extends RowDataPacket {
  id: number
  name: string
  alternateTitle: string
  releaseDate: Date
  description: string
  poster_path: string
  type: string
  myRating: number
  publicRating: number
  isDropped: boolean
  isDeleted: boolean
  createDate: Date
  updateDate: Date
  externalId: number
  runtime: number
  episodes: number
  seasons: number
  external_link: string
  author: string
  studio: string
  // content_rating_id: u.content_rating_id,
  difficulty: number
}

async function main() {
  //Connect to the OLD db directly
  const oldDb = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: process.env.OLD_DB_PASSWORD!,
    database: 'trustyfox$review_site',
  })

  //  Pull rows from the old schema
  const [oldMedia] = await oldDb.execute<LegacyUserRow[]>('SELECT * FROM Medias')

  // Transform old rows into the new schema's shape
  const transformed = []

  // loop entries
  for (const u of oldMedia.slice(0)) {
    const mediaType = toMediaType(u.media_type)

    // Skip not found
    if (mediaType == undefined) continue

    // base data
    const mapped_entry: Prisma.MediaCreateInput = {
      title: u.name,
      alternateTitle: u.name != u.external_name ? u.external_name : null,
      releaseDate: u.release_date,
      overview: u.overview,
      type: mediaType,
      publicRating: u.public_rating,
      isDeleted: Boolean(u.is_deleted),
      createDate: u.created_at,
      updateDate: u.updated_at,
      externalId: u.external_id,
      // runtime: u.runtime,
      // episodes: u.episodes,
      // seasons: u.seasons,
      // external_link: u.external_link,
      // author: u.author,
      // studio: u.studio,
      // content_rating_id: u.content_rating_id,
    }

    //  per media data
    switch (mediaType) {
      case 'MOVIE':
        mapped_entry.movie = {
          create: {
            runtime: u.runtime,
            studio: u.studio,
            author: u.author,
          },
        }
        break
      case 'TVSHOW':
        mapped_entry.tvShow = {
          create: {
            episodeCount: u.episodes,
            seasonCount: u.seasons,
            network: u.network,
          },
        }
        break
      case 'MANGA':
        mapped_entry.manga = {
          create: {
            chapterCount: u.chapters,
            volumeCount: u.volumes,
            author: u.author,
            publisher: u.publisher,
          },
        }
        break
      case 'GAME':
        mapped_entry.game = {
          create: {
            platform: u.platform,
            developer: u.developer,
            publisher: u.publisher,
          },
        }
        break
      case 'COMIC':
        mapped_entry.comic = {
          create: {
            author: u.author,
          },
        }
        break
    }

    // create review object
    if (u.user_rating != null) {
      mapped_entry.review = {
        create: {
          rating: u.user_rating ?? 0,
          difficulty: u.difficulty ?? 0,
        },
      }
    }

    transformed.push(mapped_entry)
  }

  // insert to db
  for (const item of transformed) {
    try {
      await db.media.create({ data: item })
    } catch (err) {
      console.log(item.title)
      // @ts-expect-error printing for debug
      console.log(err.meta)
    }
  }

  await oldDb.end()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
