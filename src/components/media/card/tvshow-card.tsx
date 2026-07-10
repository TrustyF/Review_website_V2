import { MediaCard } from '@/components/media/card/media-card'
import { Media, TvShow } from '@prisma/client'

export function TvShowCard({ media, tvShow }: { media: Media; tvShow: TvShow }) {
  return (
    <MediaCard media={media}>
      <p className="text-sm text-gray-400">
        {tvShow.seasonCount} seasons {tvShow.network && `· ${tvShow.network}`}
      </p>
    </MediaCard>
  )
}
