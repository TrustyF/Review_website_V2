import { db } from '@/lib/db'

export async function GET() {
  const movies = await db.media.findMany()
  return Response.json(movies)
}

export async function POST(req: Request) {
  await req.json()
}
