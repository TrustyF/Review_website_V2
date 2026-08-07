"use client";
import { useState } from "react";
import Image from "next/image";
import { MediaRecord } from "@/components/media/types";
import {
	getAlternativeBanners,
	updateMediaBanner,
} from "@/components/media/media-management/media-editor/media-editor-actions";
import { useIsAdminStore } from "@/lib/is-admin-store";
import { useImageEditPopover } from "@/components/media/media-management/media-detail-inline-editor/use-image-edit-popover";
import { EditImagePopover } from "@/components/media/media-management/media-detail-inline-editor/edit-image-popover";
import styles from "./banner-edit-trigger.module.sass";

type Props = {
	media: MediaRecord;
	// Only rendered by the page inside its own `{media.bannerSrc && (...)}`
	// check — narrowed to a plain string there, so this never has to handle
	// "no banner yet" itself.
	bannerSrc: string;
	// All four are the page's own classes — passed through unchanged so
	// swapping this in for the original inline JSX doesn't touch how the
	// banner is actually laid out. See media-detail.module.sass: .banner
	// sizes the whole thing (aspect-ratio); .banner_visual is the part that
	// sits at z-index: -10 behind the header (image + gradient); the click
	// target below is a sibling of .banner_visual, not a descendant, so it
	// isn't trapped in that same negative stacking context.
	bannerClassName: string | undefined;
	visualClassName: string | undefined;
	imageClassName: string | undefined;
	backdropClassName: string | undefined;
};

// Drop-in replacement for the detail page's banner block — click it to open
// a picker anchored over the banner, same picker UI the full editor modal
// uses. Owns the .banner_visual/.banner_backdrop wrapper divs (not just the
// <Image>) specifically so the click target can be placed as a sibling of
// the decorative, negative-z-index layer rather than nested inside it — a
// descendant can never paint above whatever its ancestor's stacking context
// is buried behind, no matter what z-index it sets on itself, so escaping
// that nesting is the only thing that actually makes this clickable over
// the header-overlapped portion of the banner.
export function BannerEditTrigger({
	media,
	bannerSrc,
	bannerClassName,
	visualClassName,
	imageClassName,
	backdropClassName,
}: Props) {
	const isAdmin = useIsAdminStore((s) => s.isAdmin);
	// Destructured rather than kept as one `popover` object — see the same
	// note in poster-edit-trigger.tsx: an object holding a ref taints every
	// property read off it as far as the react-hooks lint rule is concerned.
	const {
		src,
		containerRef,
		isOpen,
		setIsOpen,
		isSaving,
		error,
		urlInput,
		setUrlInput,
		pick,
		submitUrl,
		saveDraft,
		discardDraft,
		pendingPath,
	} = useImageEditPopover({
		initialSrc: bannerSrc,
		// resolveBanner's return type is nullable in general (a banner is
		// optional on Media), but this is only ever called with a real path
		// we just picked/pasted, so the null case can't actually happen here
		// — falling back to that same path keeps the type honest without an
		// unsafe assertion.
		save: async (path) => (await updateMediaBanner(media.id, path)) ?? path,
	});

	// Same fade-in-on-load treatment as MediaPoster (see primitives.module.
	// sass's own comment on .poster_frame/.poster) — .banner_visual carries a
	// placeholder background behind this, so there's a calm box on screen
	// instead of a blank flash while the image is still loading, and instead
	// of a hard pop once it's in. Reset whenever src itself changes (picking
	// a new banner) rather than just on mount, so swapping banners fades the
	// same way the very first load does.
	const [isLoaded, setIsLoaded] = useState(false);
	const [loadedSrc, setLoadedSrc] = useState(src);
	if (src !== loadedSrc) {
		setIsLoaded(false);
		setLoadedSrc(src);
	}

	const image = (
		<Image
			src={src}
			alt={`${media.title} banner`}
			width={1280}
			height={720}
			className={`${imageClassName ?? ""} ${styles.image} ${isLoaded ? styles.image_loaded : ""}`}
			onLoad={() => setIsLoaded(true)}
			priority
		/>
	);

	if (!isAdmin) {
		return (
			<div className={bannerClassName}>
				<div className={visualClassName}>
					{image}
					<div className={backdropClassName}></div>
				</div>
			</div>
		);
	}

	return (
		<div className={bannerClassName} ref={containerRef}>
			<div className={visualClassName}>
				{image}
				<div className={backdropClassName}></div>
			</div>

			<button
				type="button"
				className={styles.click_target}
				aria-label="Change banner"
				onClick={() => setIsOpen((v) => !v)}
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
					optionClipTop={0}
					optionClipBottom={32}
					urlInput={urlInput}
					onUrlInputChange={setUrlInput}
					onSubmitUrl={submitUrl}
					pendingPath={pendingPath}
					onSave={saveDraft}
					isSaving={isSaving}
					error={error}
					onClose={discardDraft}
				/>
			)}
		</div>
	);
}
