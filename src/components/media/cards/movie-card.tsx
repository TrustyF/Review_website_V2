// cards/MovieCard.tsx
import { MediaRecord } from '@/components/media/types'
import style from './movie-card.module.css'
import { MediaPoster } from '@/components/media/primitives/poster'
import { MediaYear } from '@/components/media/primitives/release-date'

type Props = { media: MediaRecord & { movie: NonNullable<MediaRecord['movie']> } }

export async function MovieCard({ media }: Props) {
  return (
    <div className={style.wrapper}>
      <MediaPoster mediaId={media.id} posterPath={media.posterPath} title={media.title} />
      <div className={style.info}>
        {/*<MediaTitle title={media.title} />*/}
        <MediaYear date={media.releaseDate} />
        <span className={style.runtime}>{media.movie.runtime} min</span>
        {/*<MediaOverview overview={media.overview} />*/}
        {/*<MediaRating rating={media.publicRating} />*/}
      </div>
    </div>
  )
}
