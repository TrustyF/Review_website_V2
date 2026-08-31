"use client";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import styles from "./person-photo.module.sass";

// Shared photo-or-placeholder branching for anywhere a Person's photo shows up. photoClassName/placeholderClassName append on top of the shared default look rather than reliably overriding it — CSS Modules give no guarantee which of two same-specificity classes wins.
export function PersonPhoto({
	src,
	alt,
	photoClassName,
	placeholderClassName,
	iconSize = 18,
}: {
	src: string | null;
	alt: string;
	// Matches CSS module class lookups' possibly-undefined typing; both are genuinely optional anyway.
	photoClassName?: string | undefined;
	placeholderClassName?: string | undefined;
	iconSize?: number;
}) {
	// Preloaded off-DOM rather than tracking the visible <img>'s onLoad — otherwise the browser's alt-text fallback would show while loading instead of this component's placeholder tile.
	const [isLoaded, setIsLoaded] = useState(false);
	// Resets on src change via the render-phase pattern — same convention as use-lazy-reveal.ts's itemsKey reset.
	const [prevSrc, setPrevSrc] = useState(src);
	if (src !== prevSrc) {
		setPrevSrc(src);
		setIsLoaded(false);
	}

	useEffect(() => {
		if (!src) return;
		let cancelled = false;
		const handleLoad = () => {
			if (!cancelled) setIsLoaded(true);
		};
		const image = new window.Image();
		image.onload = handleLoad;
		image.src = src;
		// Already-cached case — onload won't fire since it's attached after a synchronously-resolved src, so drive it via queueMicrotask instead.
		if (image.complete) queueMicrotask(handleLoad);
		return () => {
			cancelled = true;
		};
	}, [src]);

	return src && isLoaded ? (
		// Proxied third-party photo, not a local/optimizable asset (same as ImagePicker's thumbnails).
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={src}
			alt={alt}
			className={`${styles.photo} ${photoClassName ?? ""}`}
		/>
	) : (
		<span className={`${styles.placeholder} ${placeholderClassName ?? ""}`}>
			<UserRound size={iconSize} />
		</span>
	);
}
