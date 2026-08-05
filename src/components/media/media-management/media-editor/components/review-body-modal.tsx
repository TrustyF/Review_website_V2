"use client";
import { useRef, useState } from "react";
import { suggestReviewCorrection } from "@/components/media/media-management/media-editor/media-editor-actions";
import { ReviewDiff } from "@/components/media/media-management/media-editor/components/review-diff";
import styles from "./review-body-modal.module.sass";

type Props = {
	body: string;
	onChange: (body: string) => void;
	onClose: () => void;
};

// Its own modal, layered on top of the main editor, rather than inline —
// the main modal's fixed-width column layout didn't have room to show the
// body textarea and the AI suggestion side by side.
export function ReviewBodyModal({ body, onChange, onClose }: Props) {
	const [suggestion, setSuggestion] = useState<string | null>(null);
	const [isSuggesting, setIsSuggesting] = useState(false);
	const [suggestError, setSuggestError] = useState<string | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

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

	// Wraps the current selection in before/after (or, with nothing selected,
	// inserts a placeholder between them) — used for both toolbar buttons
	// below. See review-body.tsx for how ||...|| and [text](url) get
	// rendered back out.
	function wrapSelection(before: string, after: string, placeholder: string) {
		const textarea = textareaRef.current;
		if (!textarea) return;
		const { selectionStart, selectionEnd } = textarea;
		const selected = body.slice(selectionStart, selectionEnd) || placeholder;
		const newBody =
			body.slice(0, selectionStart) +
			before +
			selected +
			after +
			body.slice(selectionEnd);
		onChange(newBody);

		// The re-render from onChange hasn't landed yet — wait a frame before
		// touching the textarea's own selection again.
		requestAnimationFrame(() => {
			textarea.focus();
			const start = selectionStart + before.length;
			textarea.setSelectionRange(start, start + selected.length);
		});
	}

	function handleSpoiler() {
		wrapSelection("||", "||", "spoiler");
	}

	function handleLink() {
		const url = window.prompt("Link URL:");
		if (!url) return;
		wrapSelection("[", `](${url})`, "link text");
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.panel}>
				<div className={styles.columns}>
					<label className={styles.column}>
						<div className={styles.body_header}>
							Body
							<div className={styles.body_toolbar}>
								<button
									type="button"
									title="Wrap the selected text as a spoiler"
									onClick={handleSpoiler}
								>
									Spoiler
								</button>
								<button
									type="button"
									title="Turn the selected text into a link"
									onClick={handleLink}
								>
									Link
								</button>
							</div>
						</div>
						<textarea
							ref={textareaRef}
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

				<div className={styles.actions}>
					<button onClick={onClose}>Done</button>
				</div>
			</div>
		</div>
	);
}
