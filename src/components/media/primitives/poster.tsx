"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./primitives.module.sass";
import { Tooltip } from "@/components/ui/tooltip";

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
				// /api/poster already re-encodes to WebP server-side (see
				// resolvePoster in poster-resolver.ts) at the source's own fixed
				// size — same reasoning as BannerEditTrigger's own unoptimized:
				// Vercel's Image Optimization would just redo that work, and its
				// proxy fetch can time out against that route's slow cold-cache
				// (download + re-encode + upload) path, logging
				// INVALID_IMAGE_OPTIMIZE_REQUEST for a request that's actually
				// still running and succeeds moments later.
				unoptimized
			/>
		</div>
	);

	// 0/null means "not rated for difficulty" — same as a review with no
	// rating just showing nothing rather than a 0-star. The Tooltip's own
	// wrapper (not the <svg>) carries .difficulty_notch's position/size —
	// it's a sibling of .poster_frame, not a child of it (see .poster_frame's
	// own comment in primitives.module.sass: it used to have overflow: hidden,
	// which seamed against whatever sat inside it, unrelated to the notch's
	// own positioning — dropped now, but staying a sibling still costs nothing).
	const notch =
		difficulty === 1 || difficulty === 2 ? (
			<Tooltip
				content={difficulty === 1 ? "Medium difficulty" : "Hard difficulty"}
				hitboxPadding={6}
				className={`${styles.difficulty_notch} ${difficulty === 1 ? styles.difficulty_notch_1 : styles.difficulty_notch_2}`}>
				<svg viewBox="0 0 10 10" className={styles.difficulty_notch_svg}>
					<path d="M10 0V6.8A3.2 3.2 0 016.8 10H0Z" />
				</svg>
			</Tooltip>
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
