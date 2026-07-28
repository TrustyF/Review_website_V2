import Image from "next/image";
import styles from "./primitives.module.sass";

export function MediaPoster({
	src,
	title,
	ratio = "2/3",
}: {
	src: string;
	title: string;
	ratio?: string;
}) {
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
