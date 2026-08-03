import Image from "next/image";
import Link from "next/link";
import styles from "./primitives.module.sass";

export function MediaPoster({
	src,
	title,
	mediaId,
	ratio = "2/3",
}: {
	src: string;
	title: string;
	mediaId?: number | undefined;
	ratio?: string;
}) {
	const image = (
		<Image
			src={src}
			width={500}
			height={750}
			className={styles.poster}
			alt={`${title} poster`}
			style={{ aspectRatio: ratio }}
		/>
	);

	if (mediaId == null) return image;

	return (
		<Link
			href={`/media/${mediaId}`}
			className={styles.poster_link}
		>
			{image}
		</Link>
	);
}
