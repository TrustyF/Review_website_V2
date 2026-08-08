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
	difficulty,
}: {
	src: string;
	title: string;
	mediaId?: number | undefined;
	ratio?: string;
	// Corner notch on the poster (mini-cards only — see MediaMiniCardShell,
	// the only caller that passes this). Omitted entirely by every other
	// caller (MediaCardShell, PosterEditTrigger), which just renders no notch.
	difficulty?: number | null | undefined;
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
		<div className={styles.poster_frame} style={{ aspectRatio: ratio }}>
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

	// 0/null means "not rated for difficulty" — same as a review with no
	// rating just showing nothing rather than a 0-star. A sibling of
	// .poster_frame, not a child of it — .poster_frame's own overflow:
	// hidden (there for its border-radius) was leaving a hairline seam right
	// at this notch's edge, a rounded-corner-clip rendering quirk that
	// turned out to have nothing to do with the notch's own positioning.
	// Sitting on top instead, outside that clipped box entirely, means
	// there's no clip boundary anywhere near the notch's edges to seam
	// against.
	const notch =
		difficulty === 1 || difficulty === 2 ? (
			<svg
				viewBox="0 0 10 10"
				className={`${styles.difficulty_notch} ${difficulty === 1 ? styles.difficulty_notch_1 : styles.difficulty_notch_2}`}>
				<path d="M10 0V6.8A3.2 3.2 0 016.8 10H0Z" />
			</svg>
		) : null;

	if (mediaId == null) {
		return (
			<div className={styles.poster_wrapper}>
				{image}
				{notch}
			</div>
		);
	}

	return (
		<Link href={`/media/${mediaId}`} className={styles.poster_link}>
			{image}
			{notch}
		</Link>
	);
}
