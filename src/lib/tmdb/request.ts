// lib/tmdb/client.ts
import { TmdbMovieResponse, TmdbMovieResponseSchema } from './request-schema'
import { MediaType } from '@prisma/client'
import { parseOrThrow } from '@/lib/arktype/parse-or-throw'

const TMDB_BASE = 'https://api.themoviedb.org/3'

export async function fetchTmdbById(id: string, media_type: MediaType): Promise<TmdbMovieResponse> {
  const res = await fetch(
    `${TMDB_BASE}/${media_type.toLowerCase()}/${id}?&language=en-US&append_to_response=content_ratings,credits,external_ids`,
    {
      headers: new Headers({
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
      }),
    },
  )

  if (!res.ok) throw new Error(`TMDB fetch failed for movie ${id}: ${res.statusText}`)

  const json = await res.json()
  return parseOrThrow(TmdbMovieResponseSchema, json)
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

  const json = await res.json()
  return parseOrThrow(TmdbMovieResponseSchema, json)
}
