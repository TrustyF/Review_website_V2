// types.ts
import { Comic, Game, Manga, Media, Movie, TvShow } from '@prisma/client'

export type MediaRecord = Media & {
  movie?: Movie | null
  tvShow?: TvShow | null
  manga?: Manga | null
  comic?: Comic | null
  game?: Game | null
}
