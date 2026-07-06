// lib/tmdb/client.ts
import { TmdbMovieResponse } from './types'
import { MediaType } from '@prisma/client'

const TMDB_BASE = 'https://api.themoviedb.org/3'

export async function fetchTmdbById(id: string, media_type: MediaType): Promise<TmdbMovieResponse> {
  const res = await fetch(
    `${TMDB_BASE}/${media_type.toLowerCase()}/${id}&language=en-US&append_to_response=content_ratings,credits,external_ids`,
    {
      headers: new Headers({
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
      }),
    },
  )

  if (!res.ok) throw new Error(`TMDB fetch failed for movie ${id}: ${res.statusText}`)

  return res.json()
}
export async function fetchTmdbByName(name: string, media_type: MediaType, page: number): Promise<TmdbMovieResponse> {
  const res = await fetch(
    `${TMDB_BASE}/search/${media_type.toLowerCase()}?query=${name}&include_adult=true&page=${page}`,
    {
      headers: new Headers({
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
      }),
    },
  )

  if (!res.ok) throw new Error(`TMDB fetch failed for movie ${name}: ${res.statusText}`)

  return res.json()
}
