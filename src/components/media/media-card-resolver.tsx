// MediaCardResolver.tsx
import { MediaRecord } from '@/components/media/types'
import { MovieCard } from '@/components/media/cards/movie-card'

export async function MediaCardResolver({ media }: { media: MediaRecord }) {
  switch (media.type) {
    case 'MOVIE':
      if (!media.movie) return null
      return <MovieCard media={{ ...media, movie: media.movie }} />
    case 'TVSHOW':
      if (!media.tvShow) return null
      // return <TvShowCard media={{ ...media, tvShow: media.tvShow }} />
    case 'MANGA':
      if (!media.manga) return null
      // return <MangaCard media={{ ...media, manga: media.manga }} />
    case 'COMIC':
      if (!media.comic) return null
      // return <ComicCard media={{ ...media, comic: media.comic }} />
    case 'GAME':
      if (!media.game) return null
      // return <GameCard media={{ ...media, game: media.game }} />

  }
  return null
}
