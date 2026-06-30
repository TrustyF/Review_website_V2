// migrate.ts
import mysql, { RowDataPacket } from 'mysql2/promise'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { toMediaType } from '@/scripts/migration/legacy-mappers'
import 'dotenv/config'

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
  // 1. Connect to the OLD db directly
  const oldDb = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: process.env.OLD_DB_PASSWORD!,
    database: 'trustyfox$review_site',
  })

  // 2. Pull rows from the old schema
  const [oldMedia] = await oldDb.execute<LegacyUserRow[]>('SELECT * FROM Medias')

  // 3. Transform old rows into the new schema's shape
  const transformed = oldMedia.map((u) => ({
    title: u.name,
    alternateTitle: u.name != u.external_name ? u.external_name : null,
    releaseDate: u.release_date,
    description: u.overview,
    // poster_path: u.poster_path,
    type: toMediaType(u.media_type),
    myRating: u.user_rating,
    publicRating: u.public_rating,
    isDropped: u.is_dropped ?? false,
    isDeleted: u.is_deleted ?? false,
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
    difficulty: u.difficulty ?? 0,
  }))

  const trimmed = transformed.slice(0, 100)

  for (const item of trimmed) {
    try {
      await db.media.create({ data: item })
    } catch (err) {
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
