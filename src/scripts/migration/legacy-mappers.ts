import { MediaType } from '@prisma/client'

const mediaTypeMap: Record<string, MediaType> = {
  movie: MediaType.MOVIE,
  tv: MediaType.TV,
  manga: MediaType.MANGA,
  comic: MediaType.COMIC,
  game: MediaType.GAME,
}

export function toMediaType(value: string): MediaType {
  const mapped = mediaTypeMap[value.toLowerCase().trim()]
  if (!mapped) {
    console.log(`Unknown media type: ${value}`)
    return MediaType.MOVIE
  }
  return mapped
}
