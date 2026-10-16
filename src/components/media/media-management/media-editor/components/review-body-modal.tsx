"use client";
import {
	type Dispatch,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from "react";
import { useAsyncAction } from "@/lib/use-async-action";
import {
	suggestReviewCorrection,
	suggestReviewTranslation,
} from "@/components/media/media-management/media-editor/review-ai-actions";
import {
	discardReviewDraft,
	getReviewDraft,
	saveReviewDraft,
} from "@/components/media/media-management/media-editor/media-editor-actions";
import {
	TRANSLATION_MODELS,
	type TranslationModelId,
} from "@/lib/claude-model";
import { resolveReviewImageUrl } from "@/components/media/media-management/media-editor/review-image-actions";
import {
	formatBytes,
	HEAVY_IMAGE_BYTES,
} from "@/app/dev/image-crop/crop-shapes";
import { ReviewDiff } from "@/components/media/media-management/media-editor/components/review-diff";
import {
	ReviewBody,
	ReviewSpoilerProvider,
} from "@/components/media/media-cards/media-card/review-body";
import reviewStyles from "@/components/media/media-cards/media-card/review.module.sass";
import styles from "./review-body-modal.module.sass";

const AUTOSAVE_DELAY_MS = 2000;

type Texts = { body: string; bodyFr: string };

type Props = {
	// The staged-or-published text; edits stay local until onDone.
	initialBody: string;
	initialBodyFr: string;
	// Stages the text for publishing in the parent editor.
	onDone: (body: string, bodyFr: string) => void;
	// Closes without staging — the text stays in the saved draft.
	onClose: () => void;
	// null when there's no review row yet (no saved rating) to hold a draft.
	draftMediaId: number | null;
	// Owns the reviews/images/<mediaId>/ dir pasted crops are copied into.
	mediaId: number;
};

// Its own modal, not inline, since the main modal's fixed-width columns had no room to show
// the body textarea and AI suggestion side by side.
export function ReviewBodyModal({
	initialBody,
	initialBodyFr,
	onDone,
	onClose,
	draftMediaId,
	mediaId,
}: Props) {
	const [activeLang, setActiveLang] = useState<"en" | "fr">("en");

	const [body, onChange] = useState(initialBody);
	const [bodyFr, onChangeFr] = useState(initialBodyFr);

	// Last text known to be in the DB draft (or the initial text when there's none) — autosave diffs against it.
	const [saved, setSaved] = useState<Texts>({
		body: initialBody,
		bodyFr: initialBodyFr,
	});
	const [draftLoaded, setDraftLoaded] = useState(draftMediaId === null);
	const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
	const [draftSaving, setDraftSaving] = useState(false);
	const [draftError, setDraftError] = useState<string | null>(null);
	// Serializes writes so an older autosave can't land after a newer one.
	const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));

	const isDirty = body !== saved.body || bodyFr !== saved.bodyFr;

	useEffect(() => {
		if (draftMediaId === null) return;
		let cancelled = false;
		getReviewDraft(draftMediaId)
			.then((draft) => {
				if (cancelled) return;
				if (draft) {
					onChange(draft.body);
					onChangeFr(draft.bodyFr);
					setSaved({ body: draft.body, bodyFr: draft.bodyFr });
					setDraftSavedAt(draft.updatedAt);
				}
				setDraftLoaded(true);
			})
			.catch(() => {
				if (!cancelled) setDraftError("Couldn't load the draft.");
			});
		return () => {
			cancelled = true;
		};
	}, [draftMediaId]);

	// Resolves false if the write failed.
	function saveDraftNow(): Promise<boolean> {
		if (draftMediaId === null || !draftLoaded || !isDirty) {
			return saveChainRef.current;
		}
		const mediaId = draftMediaId;
		const texts = { body, bodyFr };
		saveChainRef.current = saveChainRef.current.then(async () => {
			setDraftSaving(true);
			try {
				const at = await saveReviewDraft(mediaId, texts);
				setSaved(texts);
				setDraftSavedAt(at);
				setDraftError(null);
				return true;
			} catch {
				setDraftError("Couldn't save the draft.");
				return false;
			} finally {
				setDraftSaving(false);
			}
		});
		return saveChainRef.current;
	}

	// Debounced: each keystroke resets the timer.
	useEffect(() => {
		if (draftMediaId === null || !draftLoaded || !isDirty) return;
		const timer = setTimeout(saveDraftNow, AUTOSAVE_DELAY_MS);
		return () => clearTimeout(timer);
	});

	async function handleDiscardDraft() {
		if (draftMediaId === null) return;
		if (!window.confirm("Discard the draft and go back to the current text?")) {
			return;
		}
		try {
			await saveChainRef.current;
			await discardReviewDraft(draftMediaId);
			onChange(initialBody);
			onChangeFr(initialBodyFr);
			setSaved({ body: initialBody, bodyFr: initialBodyFr });
			setDraftSavedAt(null);
			setDraftError(null);
		} catch {
			setDraftError("Couldn't discard the draft.");
		}
	}

	// Stays open if the draft write fails, so closing never loses text.
	async function handleClose() {
		if (await saveDraftNow()) onClose();
	}

	// Flushes first so the draft matches the staged text — saveReview then retires it on publish.
	async function handleDone() {
		await saveDraftNow();
		onDone(body, bodyFr);
	}

	function draftStatus(): string {
		if (draftMediaId === null) return "Save a rating first to keep drafts.";
		if (!draftLoaded) return draftError ?? "Loading draft…";
		if (draftError) return draftError;
		if (draftSaving) return "Saving draft…";
		if (isDirty) return "Unsaved changes";
		if (draftSavedAt) {
			return `Draft saved ${draftSavedAt.toLocaleString(undefined, {
				dateStyle: "short",
				timeStyle: "short",
			})}`;
		}
		return "No draft";
	}

	const [suggestion, setSuggestion] = useState<string | null>(null);
	const suggest = useAsyncAction();
	const enTextareaRef = useRef<HTMLTextAreaElement>(null);

	const translate = useAsyncAction();
	const [translateModel, setTranslateModel] = useState<TranslationModelId>(
		TRANSLATION_MODELS[0].id,
	);
	const [lastTranslation, setLastTranslation] = useState<{
		label: string;
		costUsd: number;
	} | null>(null);
	const frTextareaRef = useRef<HTMLTextAreaElement>(null);

	async function handleSuggest() {
		if (!body.trim()) return;
		await suggest.run(async () => {
			setSuggestion(await suggestReviewCorrection(body));
		}, "Failed to get a suggestion. Try again.");
	}

	async function handleTranslate() {
		if (!body.trim()) return;
		await translate.run(async () => {
			const { text, costUsd } = await suggestReviewTranslation(
				body,
				translateModel,
			);
			onChangeFr(text);
			const label =
				TRANSLATION_MODELS.find((option) => option.id === translateModel)
					?.label ?? translateModel;
			setLastTranslation({ label, costUsd });
		}, "Failed to translate. Try again.");
	}

	// Wraps the current selection in before/after, or inserts a placeholder if nothing's selected.
	function wrapSelection(
		text: string,
		onChangeText: (value: string) => void,
		textarea: HTMLTextAreaElement,
		before: string,
		after: string,
		placeholder: string,
	) {
		const { selectionStart, selectionEnd } = textarea;
		const selected = text.slice(selectionStart, selectionEnd) || placeholder;
		const newText =
			text.slice(0, selectionStart) +
			before +
			selected +
			after +
			text.slice(selectionEnd);
		onChangeText(newText);

		// The re-render from onChange hasn't landed yet — wait a frame before touching selection.
		requestAnimationFrame(() => {
			textarea.focus();
			const start = selectionStart + before.length;
			textarea.setSelectionRange(start, start + selected.length);
		});
	}

	function handleSpoiler(
		text: string,
		onChangeText: (value: string) => void,
		textarea: HTMLTextAreaElement | null,
	) {
		if (!textarea) return;
		wrapSelection(text, onChangeText, textarea, "||", "||", "spoiler");
	}

	const imageInsert = useAsyncAction();

	// Inserts open + selected text + close as its own paragraph (blank lines added only where missing),
	// then selects the wrapped text. Functional update, so it's safe after an await.
	function insertBlock(
		setText: Dispatch<SetStateAction<string>>,
		textarea: HTMLTextAreaElement,
		selectionStart: number,
		selectionEnd: number,
		open: string,
		close: string,
	) {
		let innerStart = 0;
		let innerLength = 0;
		setText((text) => {
			const start = Math.min(selectionStart, text.length);
			const end = Math.min(selectionEnd, text.length);
			const prefix = text.slice(0, start);
			const suffix = text.slice(end);
			const inner = text.slice(start, end);
			const before =
				prefix === "" || prefix.endsWith("\n\n")
					? ""
					: prefix.endsWith("\n")
						? "\n"
						: "\n\n";
			const after =
				suffix === "" || suffix.startsWith("\n\n")
					? ""
					: suffix.startsWith("\n")
						? "\n"
						: "\n\n";
			innerStart = start + before.length + open.length;
			innerLength = inner.length;
			return `${prefix}${before}${open}${inner}${close}${after}${suffix}`;
		});

		requestAnimationFrame(() => {
			if (!textarea.isConnected) return;
			textarea.focus();
			textarea.setSelectionRange(innerStart, innerStart + innerLength);
		});
	}

	// Inserts [spacer] after the selection, cursor before "]" so " =40" can be typed straight away.
	function handleSpacer(
		setText: Dispatch<SetStateAction<string>>,
		textarea: HTMLTextAreaElement | null,
	) {
		if (!textarea) return;
		const at = textarea.selectionEnd;
		insertBlock(setText, textarea, at, at, "[spacer", "]");
	}

	// Inserts ![selection](clipboard URL) as its own paragraph; an empty selection leaves the cursor in the alt brackets.
	// A /cropped/ URL is first copied into the media's review-image dir, since crops expire after 24h.
	async function handleImage(
		setText: Dispatch<SetStateAction<string>>,
		textarea: HTMLTextAreaElement | null,
	) {
		if (!textarea) return;
		const { selectionStart, selectionEnd } = textarea;

		await imageInsert.run(
			async () => {
				const input = await readClipboardImageUrl();
				let result = await resolveReviewImageUrl(mediaId, input);
				if ("heavyBytes" in result) {
					const keep = window.confirm(
						`This image is ${formatBytes(result.heavyBytes)}, over the ${formatBytes(HEAVY_IMAGE_BYTES)} guideline. Resize it in the crop tool to keep storage down, or insert it anyway?`,
					);
					if (!keep) return;
					result = await resolveReviewImageUrl(mediaId, input, true);
				}
				if (!("url" in result)) return;
				const { url } = result;
				// Selection becomes the alt text; the text may have changed while the URL resolved.
				insertBlock(
					setText,
					textarea,
					selectionStart,
					selectionEnd,
					"![",
					`](${url})`,
				);
			},
			(error) =>
				error instanceof ClipboardImageError
					? error.message
					: "Failed to save the image. Try again.",
		);
	}

	function handleLink(
		text: string,
		onChangeText: (value: string) => void,
		textarea: HTMLTextAreaElement | null,
	) {
		if (!textarea) return;
		const url = window.prompt("Link URL:");
		if (!url) return;
		wrapSelection(text, onChangeText, textarea, "[", `](${url})`, "link text");
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.panel}>
				<div className={styles.tabs}>
					<button
						type="button"
						className={activeLang === "en" ? styles.tab_active : ""}
						onClick={() => setActiveLang("en")}>
						English
					</button>
					<button
						type="button"
						className={activeLang === "fr" ? styles.tab_active : ""}
						onClick={() => setActiveLang("fr")}>
						Français
					</button>
				</div>

				{activeLang === "en" ? (
					<div className={styles.columns}>
						<ReviewPreview text={body} />
						<label className={styles.column}>
							<div className={styles.body_header}>
								Body
								<div className={styles.body_toolbar}>
									<button
										type="button"
										title="Wrap the selected text as a spoiler"
										onClick={() =>
											handleSpoiler(body, onChange, enTextareaRef.current)
										}>
										Spoiler
									</button>
									<button
										type="button"
										title="Turn the selected text into a link"
										onClick={() =>
											handleLink(body, onChange, enTextareaRef.current)
										}>
										Link
									</button>
									<button
										type="button"
										title="Insert the image URL on the clipboard, e.g. a path the crop tool just copied (selected text becomes its description)"
										disabled={imageInsert.pending}
										onClick={() =>
											handleImage(onChange, enTextareaRef.current)
										}>
										{imageInsert.pending ? "Saving…" : "Image"}
									</button>
									<button
										type="button"
										title="Insert blank vertical space; add =N inside the brackets for N px"
										onClick={() =>
											handleSpacer(onChange, enTextareaRef.current)
										}>
										Spacer
									</button>
								</div>
							</div>
							{imageInsert.error && (
								<div className={styles.suggest_error}>{imageInsert.error}</div>
							)}
							<textarea
								ref={enTextareaRef}
								className={styles.textarea}
								value={body}
								onChange={(e) => onChange(e.target.value)}
								readOnly={!draftLoaded}
								rows={16}
								autoFocus
							/>
						</label>

						<div className={styles.column}>
							<div className={styles.suggestion_header}>
								Suggested body — click a highlighted change to apply it, or copy
								text directly
								<button
									type="button"
									onClick={handleSuggest}
									disabled={suggest.pending || !body.trim()}>
									{suggest.pending ? "Suggesting…" : "Suggest correction"}
								</button>
							</div>

							{suggest.error && (
								<div className={styles.suggest_error}>{suggest.error}</div>
							)}

							{suggestion !== null ? (
								<ReviewDiff
									before={body}
									after={suggestion}
									onApplyChange={onChange}
								/>
							) : (
								<div className={styles.placeholder}>
									Click &quot;Suggest correction&quot; for an AI-proofread
									version to compare against.
								</div>
							)}
						</div>
					</div>
				) : (
					<div className={styles.columns}>
						<ReviewPreview text={bodyFr} />
						<label className={styles.column}>
							<div className={styles.body_header}>
								Corps (français)
								<div className={styles.body_toolbar}>
									<button
										type="button"
										title="Wrap the selected text as a spoiler"
										onClick={() =>
											handleSpoiler(bodyFr, onChangeFr, frTextareaRef.current)
										}>
										Spoiler
									</button>
									<button
										type="button"
										title="Turn the selected text into a link"
										onClick={() =>
											handleLink(bodyFr, onChangeFr, frTextareaRef.current)
										}>
										Link
									</button>
									<button
										type="button"
										title="Insert the image URL on the clipboard, e.g. a path the crop tool just copied (selected text becomes its description)"
										disabled={imageInsert.pending}
										onClick={() =>
											handleImage(onChangeFr, frTextareaRef.current)
										}>
										{imageInsert.pending ? "Saving…" : "Image"}
									</button>
									<button
										type="button"
										title="Insert blank vertical space; add =N inside the brackets for N px"
										onClick={() =>
											handleSpacer(onChangeFr, frTextareaRef.current)
										}>
										Spacer
									</button>
								</div>
							</div>
							{imageInsert.error && (
								<div className={styles.suggest_error}>{imageInsert.error}</div>
							)}
							<textarea
								ref={frTextareaRef}
								className={styles.textarea}
								value={bodyFr}
								onChange={(e) => onChangeFr(e.target.value)}
								readOnly={!draftLoaded}
								rows={16}
							/>
						</label>

						<div className={styles.column}>
							<div className={styles.suggestion_header}>
								Translate the English body into French
								<div className={styles.translate_controls}>
									<select
										title="Model used for the translation (low effort)"
										value={translateModel}
										disabled={translate.pending}
										onChange={(e) =>
											setTranslateModel(e.target.value as TranslationModelId)
										}>
										{TRANSLATION_MODELS.map((option) => (
											<option key={option.id} value={option.id}>
												{option.label}
											</option>
										))}
									</select>
									<button
										type="button"
										onClick={handleTranslate}
										disabled={translate.pending || !body.trim()}>
										{translate.pending
											? "Translating…"
											: "Translate from English"}
									</button>
								</div>
							</div>

							{translate.error && (
								<div className={styles.suggest_error}>{translate.error}</div>
							)}
							{lastTranslation && !translate.pending && (
								<div className={styles.translate_cost}>
									Last translation: {lastTranslation.label}, $
									{lastTranslation.costUsd.toFixed(4)}
								</div>
							)}

							<div className={styles.placeholder}>
								Click &quot;Translate from English&quot; to fill the field on
								the left with an AI translation of the current English body.
								This overwrites whatever&apos;s already there — edit freely
								afterward.
							</div>
						</div>
					</div>
				)}

				<div className={styles.actions}>
					<span
						className={
							draftError ? styles.draft_status_error : styles.draft_status
						}>
						{draftStatus()}
					</span>
					{draftMediaId !== null && (
						<>
							<button
								type="button"
								onClick={handleDiscardDraft}
								disabled={!draftLoaded || draftSavedAt === null}>
								Discard draft
							</button>
							<button
								type="button"
								onClick={saveDraftNow}
								disabled={!draftLoaded || !isDirty || draftSaving}>
								Save draft
							</button>
							<button
								type="button"
								title="Close and keep this as an unpublished draft"
								onClick={handleClose}
								// Stays enabled on a failed load so the modal can't trap you.
								disabled={!draftLoaded && !draftError}>
								Close
							</button>
						</>
					)}
					<button
						type="button"
						title="Stage this text to go live with the editor's Save / Publish"
						onClick={handleDone}
						disabled={!draftLoaded}>
						Done
					</button>
				</div>
			</div>
		</div>
	);
}

// Live render of the text as it'll appear on the media page, same component and .body styling.
function ReviewPreview({ text }: { text: string }) {
	return (
		<div className={styles.column}>
			<div className={styles.body_header}>Preview</div>
			<div className={styles.preview}>
				{text.trim() ? (
					<div className={reviewStyles.body}>
						<ReviewSpoilerProvider>
							<ReviewBody text={text} />
						</ReviewSpoilerProvider>
					</div>
				) : (
					<span className={styles.preview_empty}>Nothing to preview yet.</span>
				)}
			</div>
		</div>
	);
}

// Clipboard problems get their own message instead of the generic save failure.
class ClipboardImageError extends Error {}

// The Image button's source: whatever URL is on the clipboard, e.g. a path the crop tool just copied.
async function readClipboardImageUrl(): Promise<string> {
	let text: string;
	try {
		text = (await navigator.clipboard.readText()).trim();
	} catch {
		throw new ClipboardImageError(
			"Couldn't read the clipboard. Allow clipboard access and try again.",
		);
	}
	if (!/^(https?:\/\/|\/)\S+$/.test(text)) {
		throw new ClipboardImageError(
			"Copy an image URL (or save a crop) first. The clipboard doesn't hold one.",
		);
	}
	return text;
}
