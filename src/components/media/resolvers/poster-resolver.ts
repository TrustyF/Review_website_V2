// src/lib/poster-resolver.ts
import { access, mkdir, writeFile } from 'fs/promises'
import path from 'path'

const POSTER_DIR = path.join(process.cwd(), 'public', 'posters', 'cache')

export async function resolvePoster(mediaId: number, posterPath: string | null) {
  if (!posterPath) return '/posters/placeholder.jpg'

  const filename = `${mediaId}.jpg`
  const filePath = path.join(POSTER_DIR, filename)

  try {
    await access(filePath)
  } catch {
    await mkdir(POSTER_DIR, { recursive: true })
    const res = await fetch(`https://image.tmdb.org/t/p/w500${posterPath}`)
    if (!res.ok) throw new Error('Poster download failed')
    await writeFile(filePath, Buffer.from(await res.arrayBuffer()))
  }

  return `/posters/cache/${filename}`
}
