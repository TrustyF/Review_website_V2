import Image from "next/image";
import { resolvePoster } from "@/components/media/resolvers/poster-resolver";
import styles from "./primitives.module.sass";

export async function MediaPoster({
	mediaId,
	posterPath,
	title,
	ratio = "2/3",
}: {
	mediaId: number;
	posterPath: string | null;
	title: string;
	ratio?: string;
}) {
	const src = await resolvePoster(mediaId, posterPath);
	return (
		<Image
			src={src}
			width={500}
			height={750}
			className={styles.poster}
			alt={`${title} poster`}
			style={{ aspectRatio: ratio }}
		/>
	);
}
