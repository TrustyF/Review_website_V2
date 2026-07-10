import { MediaCard } from '@/components/media/card/media-card'
import { Media, Movie } from '@prisma/client'

export function MovieCard({ media, movie }: { media: Media; movie: Movie }) {
  return (
    <MediaCard media={media}>
      <p>
        {movie.runtime} min
        {movie.budget} vs {movie.revenue}
      </p>
    </MediaCard>
  )
}
