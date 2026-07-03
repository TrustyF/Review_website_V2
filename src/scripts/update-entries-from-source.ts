import { db } from '@/lib/db'
import { Media } from '@prisma/client'

async function request_tmdb(media: Media) {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${media.externalId}`,
  )
}

async function main() {
  // fetch media
  const mediaList = await db.media.findMany({
    where: { enrichmentStatus: 'PENDING' },
  })
  // loop
  for (const media of mediaList) {
    let requested_data = null
    if (media.type == "MOVIE") requested_data = request_tmdb(media)
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
