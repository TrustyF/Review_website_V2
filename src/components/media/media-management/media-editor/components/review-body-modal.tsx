"use client";
import { useRef, useState } from "react";
import {
	suggestReviewCorrection,
	suggestReviewTranslation,
} from "@/components/media/media-management/media-editor/media-editor-actions";
import { ReviewDiff } from "@/components/media/media-management/media-editor/components/review-diff";
import styles from "./review-body-modal.module.sass";

type Props = {
	body: string;
	onChange: (body: string) => void;
	bodyFr: string;
	onChangeFr: (bodyFr: string) => void;
	onClose: () => void;
};

// Its own modal, not inline, since the main modal's fixed-width columns had no room to show
// the body textarea and AI suggestion side by side.
export function ReviewBodyModal({ body, onChange, bodyFr, onChangeFr, onClose }: Props) {
	const [activeLang, setActiveLang] = useState<"en" | "fr">("en");

	const [suggestion, setSuggestion] = useState<string | null>(null);
	const [isSuggesting, setIsSuggesting] = useState(false);
	const [suggestError, setSuggestError] = useState<string | null>(null);
	const enTextareaRef = useRef<HTMLTextAreaElement>(null);

	const [isTranslating, setIsTranslating] = useState(false);
	const [translateError, setTranslateError] = useState<string | null>(null);
	const frTextareaRef = useRef<HTMLTextAreaElement>(null);

	async function handleSuggest() {
		if (!body.trim()) return;
		setIsSuggesting(true);
		setSuggestError(null);
		try {
			setSuggestion(await suggestReviewCorrection(body));
		} catch {
			setSuggestError("Failed to get a suggestion. Try again.");
		} finally {
			setIsSuggesting(false);
		}
	}

	async function handleTranslate() {
		if (!body.trim()) return;
		setIsTranslating(true);
		setTranslateError(null);
		try {
			onChangeFr(await suggestReviewTranslation(body));
		} catch {
			setTranslateError("Failed to translate. Try again.");
		} finally {
			setIsTranslating(false);
		}
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
			text.slice(0, selectionStart) + before + selected + after + text.slice(selectionEnd);
		onChangeText(newText);

		// The re-render from onChange hasn't landed yet — wait a frame before touching selection.
		requestAnimationFrame(() => {
			textarea.focus();
			const start = selectionStart + before.length;
			textarea.setSelectionRange(start, start + selected.length);
		});
	}

	function handleSpoiler(text: string, onChangeText: (value: string) => void, textarea: HTMLTextAreaElement | null) {
		if (!textarea) return;
		wrapSelection(text, onChangeText, textarea, "||", "||", "spoiler");
	}

	function handleLink(text: string, onChangeText: (value: string) => void, textarea: HTMLTextAreaElement | null) {
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
										onClick={() => handleSpoiler(body, onChange, enTextareaRef.current)}
									>
										Spoiler
									</button>
									<button
										type="button"
										title="Turn the selected text into a link"
										onClick={() => handleLink(body, onChange, enTextareaRef.current)}
									>
										Link
									</button>
								</div>
							</div>
							<textarea
								ref={enTextareaRef}
								className={styles.textarea}
								value={body}
								onChange={(e) => onChange(e.target.value)}
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
									disabled={isSuggesting || !body.trim()}
								>
									{isSuggesting ? "Suggesting…" : "Suggest correction"}
								</button>
							</div>

							{suggestError && (
								<div className={styles.suggest_error}>{suggestError}</div>
							)}

							{suggestion !== null ? (
								<ReviewDiff
									before={body}
									after={suggestion}
									onApplyChange={onChange}
								/>
							) : (
								<div className={styles.placeholder}>
									Click &quot;Suggest correction&quot; for an AI-proofread version
									to compare against.
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
										onClick={() => handleSpoiler(bodyFr, onChangeFr, frTextareaRef.current)}
									>
										Spoiler
									</button>
									<button
										type="button"
										title="Turn the selected text into a link"
										onClick={() => handleLink(bodyFr, onChangeFr, frTextareaRef.current)}
									>
										Link
									</button>
								</div>
							</div>
							<textarea
								ref={frTextareaRef}
								className={styles.textarea}
								value={bodyFr}
								onChange={(e) => onChangeFr(e.target.value)}
								rows={16}
							/>
						</label>

						<div className={styles.column}>
							<div className={styles.suggestion_header}>
								Translate the English body into French
								<button
									type="button"
									onClick={handleTranslate}
									disabled={isTranslating || !body.trim()}
								>
									{isTranslating ? "Translating…" : "Translate from English"}
								</button>
							</div>

							{translateError && (
								<div className={styles.suggest_error}>{translateError}</div>
							)}

							<div className={styles.placeholder}>
								Click &quot;Translate from English&quot; to fill the field on the
								left with an AI translation of the current English body. This
								overwrites whatever&apos;s already there — edit freely afterward.
							</div>
						</div>
					</div>
				)}

				<div className={styles.actions}>
					<button onClick={onClose}>Done</button>
				</div>
			</div>
		</div>
	);
}
