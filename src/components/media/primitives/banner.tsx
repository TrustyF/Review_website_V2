"use client";
import { forwardRef, ReactNode, useState } from "react";
import Image from "next/image";
import styles from "./primitives.module.sass";

type Props = {
	src: string;
	alt: string;
	// 0-100, vertical crop position (media.bannerFocusY).
	focusY: number;
	grainOpacity: number;
	wrapperClassName: string | undefined;
	visualClassName: string | undefined;
	imageClassName: string | undefined;
	backdropClassName: string | undefined;
	// Edit-only overlays (click target, focus slider, popover) from BannerEditTrigger.
	children?: ReactNode;
};

// Plain banner display, extracted out of BannerEditTrigger so a read-only view doesn't need
// its admin editing machinery. BannerEditTrigger passes its own edit-only overlay as children.
export const MediaBanner = forwardRef<HTMLDivElement, Props>(function MediaBanner(
	{
		src,
		alt,
		focusY,
		grainOpacity,
		wrapperClassName,
		visualClassName,
		imageClassName,
		backdropClassName,
		children,
	},
	ref,
) {
	// Fades in on load; resets on its own src change instead of relying on the caller to track it.
	const [isLoaded, setIsLoaded] = useState(false);
	const [loadedSrc, setLoadedSrc] = useState(src);
	if (src !== loadedSrc) {
		setIsLoaded(false);
		setLoadedSrc(src);
	}

	return (
		<div className={wrapperClassName} ref={ref}>
			<div className={visualClassName}>
				<Image
					src={src}
					alt={alt}
					width={1280}
					height={720}
					className={`${imageClassName ?? ""} ${styles.banner_image} ${isLoaded ? styles.banner_image_loaded : ""}`}
					style={{ objectPosition: `50% ${focusY}%` }}
					onLoad={() => setIsLoaded(true)}
					priority
				/>
				<div
					className={styles.banner_grain}
					style={{ opacity: isLoaded ? grainOpacity : 0 }}
				/>
				<div className={backdropClassName}></div>
			</div>
			{children}
		</div>
	);
});
