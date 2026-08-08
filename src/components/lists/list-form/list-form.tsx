"use client";
import { FormEvent, ReactNode, useState } from "react";
import styles from "./list-form.module.sass";

export type ListFormValues = {
	title: string;
	description: string;
	thumbnailUrl: string;
};

type Props = {
	initial: ListFormValues;
	submitLabel: string;
	onSubmit: (values: ListFormValues) => Promise<void>;
	// Edit page's "Delete list" button — rendered below the submit button,
	// kept out of this form's own submit handler since it's a separate
	// destructive action with its own confirmation, not a form field.
	extra?: ReactNode;
};

// Shared by /lists/new and /lists/[id]/edit — same three fields (title,
// description, pasted thumbnail URL) either way, only what onSubmit does
// with them differs. Mirrors add/page.tsx's manual-entry form: a plain
// controlled form, a live <img> preview of the pasted URL, no picker (see
// the plan's "paste-a-URL only" thumbnail decision — a list has no provider
// to search against).
export function ListForm({ initial, submitLabel, onSubmit, extra }: Props) {
	const [title, setTitle] = useState(initial.title);
	const [description, setDescription] = useState(initial.description);
	const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnailUrl);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!title.trim()) return;
		setIsSubmitting(true);
		setError(null);
		try {
			await onSubmit({ title, description, thumbnailUrl });
		} catch {
			setError("Failed to save. Try again.");
			setIsSubmitting(false);
		}
	}

	return (
		<form className={styles.form} onSubmit={handleSubmit}>
			<label className={styles.field}>
				Title
				<input
					className={styles.input}
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					required
					autoFocus
				/>
			</label>
			<label className={styles.field}>
				Description
				<textarea
					className={styles.textarea}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</label>
			<label className={styles.field}>
				Thumbnail URL
				<input
					className={styles.input}
					type="text"
					placeholder="https://…"
					value={thumbnailUrl}
					onChange={(e) => setThumbnailUrl(e.target.value)}
				/>
			</label>
			{thumbnailUrl.trim() && (
				// Plain <img>, not next/image — arbitrary pasted host, same as
				// add/page.tsx's manual poster preview.
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={thumbnailUrl.trim()}
					alt=""
					className={styles.thumbnail_preview}
				/>
			)}
			{error && <div className={styles.error}>{error}</div>}
			<button
				type="submit"
				className={styles.submit_button}
				disabled={isSubmitting || !title.trim()}>
				{isSubmitting ? "Saving…" : submitLabel}
			</button>
			{extra}
		</form>
	);
}
