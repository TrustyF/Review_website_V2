import { db } from '@/lib/db'

export async function GET() {
  const movies = await db.movie.findMany()
  return Response.json(movies)
}

export async function POST(req: Request) {
  const body = await req.json()

  const movie = await db.movie.create({
    data: {
      title: body.title,
      year: body.year,
    },
  })

  return Response.json(movie)
}
