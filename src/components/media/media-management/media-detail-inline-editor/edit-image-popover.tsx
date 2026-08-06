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
	urlInput: string;
	onUrlInputChange: (value: string) => void;
	onSubmitUrl: () => void;
	isSaving: boolean;
	error: string | null;
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
	urlInput,
	onUrlInputChange,
	onSubmitUrl,
	isSaving,
	error,
	onClose,
}: Props) {
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
			/>

			<div className={styles.url_row}>
				<input
					type="text"
					className={styles.url_input}
					placeholder="Paste a URL…"
					value={urlInput}
					onChange={(e) => onUrlInputChange(e.target.value)}
				/>
				<button
					type="button"
					onClick={onSubmitUrl}
					disabled={isSaving}>
					Use
				</button>
			</div>

			{isSaving && <div className={styles.status}>Saving…</div>}
			{error && <div className={styles.status_error}>{error}</div>}
		</div>
	);
}
