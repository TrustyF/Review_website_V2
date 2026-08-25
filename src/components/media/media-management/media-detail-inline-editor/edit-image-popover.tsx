import { MediaRecord } from "@/components/media/types";
import { MediaType } from "@prisma/client";
import {
	ImagePicker,
	PickableImage,
} from "@/components/media/media-management/media-editor/components/image-picker";
import styles from "./edit-image-popover.module.sass";

type Props = {
	title: string;
	draft: MediaRecord;
	fetchOptions: (
		externalId: string,
		type: MediaType,
	) => Promise<PickableImage[]>;
	onPick: (image: PickableImage) => void;
	altText: string;
	errorText: string;
	// Not `?:` — every caller passes this explicitly (undefined for posters),
	// same convention as bannerClassName etc. in banner-edit-trigger.tsx;
	// exactOptionalPropertyTypes rejects forwarding a possibly-undefined
	// value through a truly optional prop.
	optionAspectRatio: string | undefined;
	urlInput: string;
	onUrlInputChange: (value: string) => void;
	onSubmitUrl: () => void;
	// Whatever pick()/onSubmitUrl last staged, or null if nothing's staged —
	// onSave is a no-op (just closes) when this is null, and it doubles as
	// the check for whether the currently typed urlInput is the thing that's
	// actually staged (see the "will apply on publish" note below).
	pendingPath: string | null;
	// Hands off to the page-level draft and closes — synchronous, nothing
	// here touches the network (see use-image-edit-popover.ts's onStage), so
	// unlike a real save this never fails and never needs an isSaving state.
	onSave: () => void;
	// Closes without saving — discards whatever pick()/onSubmitUrl staged.
	onClose: () => void;
};

// The part of PosterEditTrigger/BannerEditTrigger that's actually identical
// between the two — a picker grid plus a paste-a-URL fallback, for feature
// parity with the same two options the full editor modal already offers.
// Only what image is being edited (and how it gets fetched/saved) differs
// between the two callers.
export function EditImagePopover({
	title,
	draft,
	fetchOptions,
	onPick,
	altText,
	errorText,
	optionAspectRatio,
	urlInput,
	onUrlInputChange,
	onSubmitUrl,
	pendingPath,
	onSave,
	onClose,
}: Props) {
	const trimmedUrl = urlInput.trim();

	return (
		<div className={styles.popover}>
			<div className={styles.header}>
				{title}
				<button
					type="button"
					className={styles.close}
					onClick={onClose}
					aria-label="Close">
					×
				</button>
			</div>

			<ImagePicker
				key={draft.id}
				draft={draft}
				fetchOptions={fetchOptions}
				onPick={onPick}
				altText={altText}
				errorText={errorText}
				optionAspectRatio={optionAspectRatio}
			/>

			<div className={styles.url_row}>
				<input
					type="text"
					className={styles.url_input}
					placeholder="Paste a URL…"
					value={urlInput}
					onChange={(e) => onUrlInputChange(e.target.value)}
				/>
				<button type="button" onClick={onSubmitUrl}>
					Use
				</button>
			</div>

			{trimmedUrl && (
				// Plain <img>, deliberately not next/image — same reasoning as the
				// full editor modal's own url_preview: a pasted URL can be any
				// host, and only gets proxied/cached once it's actually published.
				// eslint-disable-next-line @next/next/no-img-element
				<img src={trimmedUrl} alt="" className={styles.url_preview} />
			)}
			{pendingPath === trimmedUrl && trimmedUrl && (
				<span className={styles.url_applied}>Will apply on publish</span>
			)}

			<div className={styles.actions}>
				<button type="button" onClick={onClose}>
					Discard
				</button>
				<button type="button" onClick={onSave} disabled={pendingPath === null}>
					Stage
				</button>
			</div>
		</div>
	);
}
