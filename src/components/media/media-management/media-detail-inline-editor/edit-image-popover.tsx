import { MediaRecord } from "@/components/media/types";
import { MediaType } from "@prisma/client";
import {
	ImageOptionsPage,
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
		offset: number,
		limit: number,
	) => Promise<ImageOptionsPage>;
	onPick: (image: PickableImage) => void;
	altText: string;
	errorText: string;
	// Not `?:` — exactOptionalPropertyTypes rejects forwarding a possibly-undefined value
	// through a truly optional prop, so every caller passes this explicitly.
	optionAspectRatio: string | undefined;
	urlInput: string;
	onUrlInputChange: (value: string) => void;
	// Stages the pasted URL into the page-level draft and closes, same as picking a grid option.
	onSubmitUrl: () => void;
	onClose: () => void;
};

// The part shared between PosterEditTrigger/BannerEditTrigger — a picker grid plus a
// paste-a-URL fallback; only what's being edited differs between the two callers.
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
				// Plain <img>, deliberately not next/image — a pasted URL can be any host,
				// and only gets proxied/cached once actually published.
				// eslint-disable-next-line @next/next/no-img-element
				<img src={trimmedUrl} alt="" className={styles.url_preview} />
			)}
		</div>
	);
}
