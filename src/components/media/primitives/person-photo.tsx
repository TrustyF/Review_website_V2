"use client";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import styles from "./person-photo.module.sass";

// Shared photo-or-placeholder branching for anywhere a Person's photo shows
// up (cast strip, credits page, ...). Owns its own default look (see
// person-photo.module.sass) — the real photo and its placeholder share one
// definition there, so they can't drift apart the way two callers each
// hand-typing the same values could. photoClassName/placeholderClassName
// are appended on top of that default rather than replacing it, so a caller
// only needs one when it wants to *add* something the default doesn't
// already cover (e.g. credit-media-list-page.module.sass's own .photo
// adding flex-shrink/object-position on top of this) — a caller can't use
// them to reliably *override* a property the default already sets, since
// CSS Modules give no guarantee which of two same-specificity classes from
// different files wins.
export function PersonPhoto({
	src,
	alt,
	photoClassName,
	placeholderClassName,
	iconSize = 18,
}: {
	src: string | null;
	alt: string;
	// CSS module class lookups are typed as possibly-undefined (an unknown
	// key would silently produce `undefined`) — matches that rather than
	// requiring callers to non-null-assert every styles.xxx they pass, and
	// both are genuinely optional besides (see this component's own comment
	// on why a caller doesn't need one just to get the default look).
	photoClassName?: string | undefined;
	placeholderClassName?: string | undefined;
	iconSize?: number;
}) {
	// Preloaded off-DOM rather than just tracking the visible <img>'s own
	// onLoad — swapping straight to an <img> the instant src is known would
	// otherwise show the browser's default "not loaded yet" state (the alt
	// text, rendered as plain text in place of the image) for however long
	// the fetch takes, instead of this component's own placeholder tile. By
	// the time isLoaded flips, the browser has already cached this exact URL,
	// so the real <img> below mounts already-decoded rather than re-fetching.
	const [isLoaded, setIsLoaded] = useState(false);
	// Resets on an actual src change via the render-phase pattern (rather
	// than an unconditional setState at the top of the effect below) — same
	// convention use-lazy-reveal.ts's own itemsKey reset uses.
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
		// Already-cached case — onload won't fire since it's attached after a
		// synchronously-resolved src, so this drives the same setState through
		// a callback (queueMicrotask) instead of calling it directly from the
		// effect body itself.
		if (image.complete) queueMicrotask(handleLoad);
		return () => {
			cancelled = true;
		};
	}, [src]);

	return src && isLoaded ? (
		// Proxied third-party photo, not a local/optimizable asset (same as
		// ImagePicker's own thumbnails).
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
