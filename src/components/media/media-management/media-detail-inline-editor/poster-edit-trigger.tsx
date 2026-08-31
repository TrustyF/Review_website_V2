"use client";
import { MediaRecord } from "@/components/media/types";
import { MediaPoster } from "@/components/media/primitives/poster";
import { Hitbox } from "@/components/ui/hitbox";
import { getAlternativePosters } from "@/components/media/media-management/media-editor/media-editor-actions";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { useImageEditPopover } from "@/components/media/media-management/media-detail-inline-editor/use-image-edit-popover";
import { EditImagePopover } from "@/components/media/media-management/media-detail-inline-editor/edit-image-popover";
import { useMediaPublishStore } from "@/components/media/media-management/media-detail-inline-editor/media-publish-store";
import styles from "./poster-edit-trigger.module.sass";

type Props = {
	media: MediaRecord;
	ratio: string;
};

// Drop-in replacement for a plain <MediaPoster> — click to open a picker anchored below it.
// Every type has some way to browse alternates, so unlike BannerEditTrigger this never gates on type.
export function PosterEditTrigger({ media, ratio }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const draft = useMediaPublishStore((s) => s.draft);
	const stagePoster = useMediaPublishStore((s) => s.stagePoster);
	const draftPreviewSrc =
		draft?.mediaId === media.id ? draft.posterPreviewSrc : null;
	// Destructured rather than one `popover` object: react-hooks flags any object holding a ref
	// as tainted, treating every property read off it as "accessing a ref during render".
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
		initialSrc: media.posterSrc,
		stagedSrc: draftPreviewSrc,
		// No DB write here — stages into the page-level draft, only saved once Publish is clicked.
		onStage: (path, previewSrc) => stagePoster(media.id, path, previewSrc),
	});

	if (!isAdmin) {
		return (
			<MediaPoster src={media.posterSrc} title={media.title} ratio={ratio} />
		);
	}

	return (
		<div className={styles.wrapper} ref={containerRef}>
			<Hitbox onClick={() => setIsOpen((v) => !v)}>
				<MediaPoster src={src} title={media.title} ratio={ratio} />
			</Hitbox>

			{isOpen && (
				<EditImagePopover
					title="Change poster"
					draft={media}
					fetchOptions={getAlternativePosters}
					onPick={pick}
					altText="Alternative poster option"
					errorText="Couldn't load alternative posters. Try again later."
					optionAspectRatio={undefined}
					urlInput={urlInput}
					onUrlInputChange={setUrlInput}
					onSubmitUrl={submitUrl}
					onClose={close}
				/>
			)}
		</div>
	);
}
