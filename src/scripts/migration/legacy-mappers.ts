import { MediaType } from '@prisma/client'

const mediaTypeMap: Record<string, MediaType> = {
  movie: MediaType.MOVIE,
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
