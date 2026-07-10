import { Media, Movie, TvShow } from "@prisma/client";
import { ReactNode } from "react";
import style from './media-card.module.css'

type BaseMediaCardProps = {
  media: Media;
  children?: ReactNode; // type-specific extras go here
};

export function MediaCard({ media, children }: BaseMediaCardProps) {
  return (
    <div className={style.wrapper}>
      <div>{media.title}</div>
      {media.releaseDate && <span>{media.releaseDate.getFullYear()}</span>}
      {media.overview && <p>{media.overview}</p>}
      {media.publicRating != null && <span>⭐ {media.publicRating}</span>}
      {children}
    </div>
  )
}