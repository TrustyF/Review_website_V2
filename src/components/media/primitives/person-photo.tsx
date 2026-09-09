"use client";
import { useEffect, useState } from "react";
import { UserRound, Building2 } from "lucide-react";
import styles from "./person-photo.module.sass";

// Same placeholder icon convention as search-result-card.tsx's own company/person split.
const PLACEHOLDER_ICON = {
	person: UserRound,
	company: Building2,
};

// Shared photo-or-placeholder branching (Person by default, Company via `kind`).
// `kind` is a plain string, not a passed-in icon component, so a Server
// Component caller can pass it across the RSC boundary.
export function PersonPhoto({
	src,
	alt,
	photoClassName,
	placeholderClassName,
	iconSize = 18,
	kind = "person",
}: {
	src: string | null;
	alt: string;
	// Matches CSS module class lookups' possibly-undefined typing; both are genuinely optional anyway.
	photoClassName?: string | undefined;
	placeholderClassName?: string | undefined;
	iconSize?: number;
	kind?: "person" | "company";
}) {
	const Icon = PLACEHOLDER_ICON[kind];
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
			<Icon size={iconSize} />
		</span>
	);
}
