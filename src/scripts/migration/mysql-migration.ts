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
  type: string
  myRating: number
  isDropped: boolean
  isDeleted: boolean
  createDate: Date
  updateDate: Date
  externalId: number
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
      type: mediaType,
      isDeleted: Boolean(u.is_deleted),
      createDate: u.created_at,
      updateDate: u.updated_at,
      externalId: u.external_id,
    }

    switch (mediaType) {
      case 'MOVIE':
        mapped_entry.movie = {
          create: { runtime: 0 },
        }
        break
      case 'TVSHOW':
        mapped_entry.tvShow = { create: {} }
        break
      case 'MANGA':
        mapped_entry.manga = { create: {} }
        break
      case 'GAME':
        mapped_entry.game = { create: {} }
        break
      case 'COMIC':
        mapped_entry.comic = { create: {} }
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
