"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { MediaRecord } from "@/components/media/types";
import { getAlternativeBanners } from "@/components/media/media-management/media-editor/media-editor-actions";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { useImageEditPopover } from "@/components/media/media-management/media-detail-inline-editor/use-image-edit-popover";
import { EditImagePopover } from "@/components/media/media-management/media-detail-inline-editor/edit-image-popover";
import { useMediaPublishStore } from "@/components/media/media-management/media-detail-inline-editor/media-publish-store";
import styles from "./banner-edit-trigger.module.sass";

type Props = {
	media: MediaRecord;
	// Narrowed to a plain string by the page's own `{media.bannerSrc && (...)}` check.
	bannerSrc: string;
	// The page's own classes, passed through unchanged so this doesn't touch the banner layout.
	bannerClassName: string | undefined;
	visualClassName: string | undefined;
	imageClassName: string | undefined;
	backdropClassName: string | undefined;
	// Passed down rather than imported directly — poster-resolver.ts pulls in fs/promises and
	// sharp, and this is a "use client" module.
	grainOpacity: number;
};

// Drop-in replacement for the detail page's banner block — click to open the same picker UI the
// full editor modal uses. Owns the wrapper divs (not just the <Image>) so the click target can be
// a sibling of the negative-z-index decorative layer rather than nested inside it — a descendant
// can never paint above whatever its ancestor's stacking context is buried behind.
export function BannerEditTrigger({
	media,
	bannerSrc,
	bannerClassName,
	visualClassName,
	imageClassName,
	backdropClassName,
	grainOpacity,
}: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const draft = useMediaPublishStore((s) => s.draft);
	const stageBanner = useMediaPublishStore((s) => s.stageBanner);
	const stageBannerFocus = useMediaPublishStore((s) => s.stageBannerFocus);
	const hasDraft = draft?.mediaId === media.id;
	const draftPreviewSrc = hasDraft ? draft.bannerPreviewSrc : null;
	// Destructured rather than one `popover` object — an object holding a ref taints every
	// property read off it for the react-hooks lint rule.
	const {
		src,
		containerRef,
		isOpen,
		setIsOpen,
		urlInput,
		setUrlInput,
		pick,
		submitUrl,
		close,
	} = useImageEditPopover({
		initialSrc: bannerSrc,
		stagedSrc: draftPreviewSrc,
		// No DB write here — stages into the page-level draft, only saved once Publish is clicked.
		onStage: (path, previewSrc) => stageBanner(media.id, path, previewSrc),
	});

	// Fade-in-on-load, reset whenever src changes (picking a new banner) so swapping banners
	// fades the same way the first load does.
	const [isLoaded, setIsLoaded] = useState(false);
	const [loadedSrc, setLoadedSrc] = useState(src);
	if (src !== loadedSrc) {
		setIsLoaded(false);
		setLoadedSrc(src);
	}

	// Seeded from any already-staged draft value (not just media.bannerFocusY) so a pending
	// framing tweak survives a remount. Local state drives the live preview; the stage is debounced.
	const [focusY, setFocusY] = useState(
		hasDraft && draft.bannerFocusY != null
			? draft.bannerFocusY
			: media.bannerFocusY,
	);
	const focusYSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	function handleFocusYChange(value: number) {
		setFocusY(value);
		if (focusYSaveTimer.current) clearTimeout(focusYSaveTimer.current);
		focusYSaveTimer.current = setTimeout(() => {
			// No DB write here either — same staged-until-publish treatment as the picker above.
			stageBannerFocus(media.id, value);
		}, 400);
	}

	const image = (
		<Image
			src={src}
			alt={`${media.title} banner`}
			width={1280}
			height={720}
			className={`${imageClassName ?? ""} ${styles.image} ${isLoaded ? styles.image_loaded : ""}`}
			style={{ objectPosition: `50% ${focusY}%` }}
			onLoad={() => setIsLoaded(true)}
			priority
		/>
	);

	// Held at 0 until isLoaded, otherwise the grain textures the placeholder background
	// instead of the banner while the image is still loading.
	const grain = (
		<div
			className={styles.grain}
			style={{ opacity: isLoaded ? grainOpacity : 0 }}
		/>
	);

	if (!isAdmin) {
		return (
			<div className={bannerClassName}>
				<div className={visualClassName}>
					{image}
					{grain}
					<div className={backdropClassName}></div>
				</div>
			</div>
		);
	}

	return (
		<div className={bannerClassName} ref={containerRef}>
			<div className={visualClassName}>
				{image}
				{grain}
				<div className={backdropClassName}></div>
			</div>

			<button
				type="button"
				className={styles.click_target}
				aria-label="Change banner"
				onClick={() => setIsOpen((v) => !v)}
			/>

			{/* Sibling of click_target so dragging doesn't also trigger it; stopPropagation is
			    a second guard since the two visually overlap at the edge. */}
			<input
				type="range"
				min={0}
				max={100}
				value={focusY}
				onChange={(e) => handleFocusYChange(Number(e.target.value))}
				onClick={(e) => e.stopPropagation()}
				onPointerDown={(e) => e.stopPropagation()}
				className={styles.focus_slider}
				aria-label="Banner vertical framing"
			/>

			{isOpen && (
				<EditImagePopover
					title="Change banner"
					draft={media}
					fetchOptions={getAlternativeBanners}
					onPick={pick}
					altText="Alternative banner option"
					errorText="Couldn't load alternative banners. Try again later."
					optionAspectRatio="16/9"
					urlInput={urlInput}
					onUrlInputChange={setUrlInput}
					onSubmitUrl={submitUrl}
					onClose={close}
				/>
			)}
		</div>
	);
}
