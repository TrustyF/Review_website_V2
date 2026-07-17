import { resolvePoster } from '@/components/media/resolvers/poster-resolver'
import Image from 'next/image'

export async function MediaPoster({
  mediaId,
  posterPath,
  title,
}: {
  mediaId: number
  posterPath: string | null
  title: string
}) {
  const src = await resolvePoster(mediaId, posterPath)
  return <Image src={src} width={92} height={138} alt={`${title} poster`} />
}
