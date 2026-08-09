"use client";
import { ChangeEvent, FormEvent, ReactNode, useState } from "react";
import styles from "./list-form.module.sass";
import { uploadListThumbnail } from "@/components/lists/list-actions";

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
// description, thumbnail) either way, only what onSubmit does with them
// differs. Mirrors add/page.tsx's manual-entry form: a plain controlled
// form, a live <img> preview, no provider picker (a list has no provider to
// search against). Thumbnail can be set two ways — a pasted URL, or a local
// file uploaded via uploadListThumbnail — both just end up setting the same
// thumbnailUrl state, so onSubmit never needs to know which one happened.
export function ListForm({ initial, submitLabel, onSubmit, extra }: Props) {
	const [title, setTitle] = useState(initial.title);
	const [description, setDescription] = useState(initial.description);
	const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnailUrl);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
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

	async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ""; // lets the same file be re-picked later
		if (!file) return;

		setIsUploading(true);
		setError(null);
		try {
			const formData = new FormData();
			formData.append("file", file);
			setThumbnailUrl(await uploadListThumbnail(formData));
		} catch {
			setError("Failed to upload image. Try again.");
		} finally {
			setIsUploading(false);
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
			<label className={styles.field}>
				Or upload a file
				<input
					className={styles.input}
					type="file"
					accept="image/*"
					onChange={handleFileChange}
					disabled={isUploading}
				/>
			</label>
			{isUploading && <div className={styles.uploading}>Uploading…</div>}
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
