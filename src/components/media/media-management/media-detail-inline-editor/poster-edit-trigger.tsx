"use client";
import { MediaRecord } from "@/components/media/types";
import { MediaPoster } from "@/components/media/primitives/poster";
import { Hitbox } from "@/components/ui/hitbox";
import {
	getAlternativePosters,
	updateMediaPoster,
} from "@/components/media/media-management/media-editor/media-editor-actions";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useImageEditPopover } from "@/components/media/media-management/media-detail-inline-editor/use-image-edit-popover";
import { EditImagePopover } from "@/components/media/media-management/media-detail-inline-editor/edit-image-popover";
import styles from "./poster-edit-trigger.module.sass";

type Props = {
	media: MediaRecord;
	ratio: string;
};

// Drop-in replacement for a plain <MediaPoster> on the detail page — click
// the poster itself to open a picker anchored right under it, same picker
// UI the full editor modal uses. Every type has some way to browse
// alternates (TMDB, MangaDex, ComicVine issues, IGDB regional box art — see
// getAlternativePosters), so unlike BannerEditTrigger this never needs to
// gate on media type.
export function PosterEditTrigger({ media, ratio }: Props) {
	const isAdmin = useIsAdmin();
	// Destructured rather than kept as one `popover` object: the react-hooks
	// lint rule treats any object holding a ref (containerRef here) as
	// tainted as a whole, flagging every property read off it — even
	// unrelated ones like .src or .pick — as "accessing a ref during
	// render". Pulling each field into its own binding sidesteps that.
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
		initialSrc: media.posterSrc,
		save: (path) => updateMediaPoster(media.id, path),
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
