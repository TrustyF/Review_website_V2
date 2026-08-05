"use client";
import { useState } from "react";
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
	// Space is already reserved via aspect-ratio on the frame (no true CLS),
	// but an image snapping straight from blank to fully loaded still reads
	// as a jarring "pop" — especially now that whole batches of cards mount
	// at once as you scroll (see LazyTierGrid). Fading the image in over a
	// placeholder-colored frame makes that transition calm instead of abrupt.
	const [isLoaded, setIsLoaded] = useState(false);

	// next/image's own width/height are kept proportional to whatever ratio
	// is passed in (not just hardcoded to 2/3's 500x750) — object-fit:cover
	// means the CSS aspectRatio below is what actually controls the visible
	// shape either way, but a mismatched intrinsic ratio still trips next/
	// image's own dev-mode warning.
	const [ratioW, ratioH] = ratio.split("/").map(Number);
	const width = 500;
	const height = ratioW && ratioH ? Math.round((width * ratioH) / ratioW) : 750;

	const image = (
		<div
			className={styles.poster_frame}
			style={{ aspectRatio: ratio }}
		>
			<Image
				src={src}
				width={width}
				height={height}
				className={`${styles.poster} ${isLoaded ? styles.poster_loaded : ""}`}
				alt={`${title} poster`}
				onLoad={() => setIsLoaded(true)}
			/>
		</div>
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
