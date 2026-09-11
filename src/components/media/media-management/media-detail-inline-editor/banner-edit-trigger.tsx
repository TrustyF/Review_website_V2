"use client";
import { useRef, useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaBanner } from "@/components/media/primitives/banner";
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

// Owns wrapper divs (not just Image) to ensure click target isn't buried by ancestor stacking.
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

	if (!isAdmin) {
		return (
			<MediaBanner
				src={src}
				alt={`${media.title} banner`}
				focusY={focusY}
				grainOpacity={grainOpacity}
				wrapperClassName={bannerClassName}
				visualClassName={visualClassName}
				imageClassName={imageClassName}
				backdropClassName={backdropClassName}
			/>
		);
	}

	return (
		<MediaBanner
			ref={containerRef}
			src={src}
			alt={`${media.title} banner`}
			focusY={focusY}
			grainOpacity={grainOpacity}
			wrapperClassName={bannerClassName}
			visualClassName={visualClassName}
			imageClassName={imageClassName}
			backdropClassName={backdropClassName}>
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
		</MediaBanner>
	);
}
