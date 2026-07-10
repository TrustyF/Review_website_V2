import { Media, Movie, TvShow } from '@prisma/client'
import { MovieCard } from '@/components/media/card/movie-card'
import { TvShowCard } from '@/components/media/card/tvshow-card'
import { MediaCard } from '@/components/media/card/media-card'

export function MediaCardResolver({ media }: { media: Media & { movie?: Movie | null; tvShow?: TvShow | null } }) {
  if (media.type === 'MOVIE' && media.movie) return <MovieCard media={media} movie={media.movie} />
  if (media.type === 'TVSHOW' && media.tvShow) return <TvShowCard media={media} tvShow={media.tvShow} />
  return <MediaCard media={media} />
}
