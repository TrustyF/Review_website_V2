"use client";
import { useEffect, useRef, useState } from "react";
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
import { ReviewDiff } from "@/components/media/media-management/media-editor/components/review-diff";
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
};

// Its own modal, not inline, since the main modal's fixed-width columns had no room to show
// the body textarea and AI suggestion side by side.
export function ReviewBodyModal({
	initialBody,
	initialBodyFr,
	onDone,
	onClose,
	draftMediaId,
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
			onChangeFr(await suggestReviewTranslation(body));
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
								</div>
							</div>
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
								</div>
							</div>
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
								<button
									type="button"
									onClick={handleTranslate}
									disabled={translate.pending || !body.trim()}>
									{translate.pending
										? "Translating…"
										: "Translate from English"}
								</button>
							</div>

							{translate.error && (
								<div className={styles.suggest_error}>{translate.error}</div>
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
								disabled={!draftLoaded}>
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
