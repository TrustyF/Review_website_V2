"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Link } from "@/components/ui/link";
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
	// Corner notch on the poster (mini-cards only, via MediaMiniCardShell) — other callers omit it and render no notch.
	difficulty?: number | null | undefined;
}) {
	// aspect-ratio already reserves the space (no CLS), but a blank-to-loaded snap still reads as a jarring pop, especially with whole batches mounting at once (LazyTierGrid). Fade in over a placeholder frame instead.
	const [isLoaded, setIsLoaded] = useState(false);
	// Placeholder only shows after a delay, not unconditionally from mount — even a cached src resolves asynchronously on a fresh <img>, so checking img.complete right at mount is racy. Gating visibility on a delay sidesteps that: fast/cached loads never flash a placeholder at all.
	const [showPlaceholder, setShowPlaceholder] = useState(false);
	useEffect(() => {
		if (isLoaded) return;
		const timeout = setTimeout(() => setShowPlaceholder(true), 100);
		return () => clearTimeout(timeout);
	}, [isLoaded]);

	// width/height kept proportional to the passed ratio, not hardcoded to 2/3 — object-fit:cover means CSS aspectRatio controls the visible shape either way, but a mismatched intrinsic ratio still trips next/image's dev-mode warning.
	const [ratioW, ratioH] = ratio.split("/").map(Number);
	const width = 500;
	const height = ratioW && ratioH ? Math.round((width * ratioH) / ratioW) : 750;

	const image = (
		<div
			className={`${styles.poster_frame} ${showPlaceholder && !isLoaded ? styles.poster_frame_placeholder : ""}`}
			style={{ aspectRatio: ratio }}>
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

	// 0/null means "not rated for difficulty", shown as nothing. Tooltip's wrapper (not the <svg>) carries .difficulty_notch's position/size, as a sibling of .poster_frame rather than a child.
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
