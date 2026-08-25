"use client";
import { ChangeEvent, FormEvent, ReactNode, useEffect, useState } from "react";
import { ListSortMode } from "@prisma/client";
import styles from "./list-form.module.sass";
import {
	listRecommendationTargets,
	RecommendationTargetOption,
	uploadListThumbnail,
} from "@/components/lists/list-actions";
import { UserPicker } from "@/components/lists/list-form/user-picker";

export type ListFormValues = {
	title: string;
	description: string;
	thumbnailUrl: string;
	sortMode: ListSortMode;
	// null = a normal, publicly-listed list. See ListInput's own comment in
	// list-actions.ts.
	targetUserId: string | null;
};

const SORT_MODE_OPTIONS: { value: ListSortMode; label: string }[] = [
	{ value: "RANKED", label: "Ranked (drag to reorder)" },
	{ value: "RATED", label: "Grouped by rating" },
	{ value: "UNSORTED", label: "Unsorted" },
];

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
	const [sortMode, setSortMode] = useState(initial.sortMode);
	const [targetUserId, setTargetUserId] = useState(initial.targetUserId);
	const [targets, setTargets] = useState<RecommendationTargetOption[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetched once on mount rather than passed in as a prop — both call sites
	// (NewListPage, EditListForm) are already thin wrappers that would
	// otherwise need their own requireAdmin-gated query just to hand this
	// list down, for a picker that's cheap and rarely opened.
	useEffect(() => {
		listRecommendationTargets().then(setTargets);
	}, []);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!title.trim()) return;
		setIsSubmitting(true);
		setError(null);
		try {
			await onSubmit({ title, description, thumbnailUrl, sortMode, targetUserId });
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
			<div className={styles.field}>
				Recommend to
				<UserPicker options={targets} value={targetUserId} onChange={setTargetUserId} />
				{targetUserId && (
					<span className={styles.recommend_hint}>
						Only this account (and admins) will be able to see this list.
					</span>
				)}
			</div>
			<div className={styles.field}>
				Sort mode
				<div className={styles.sort_mode_row}>
					{SORT_MODE_OPTIONS.map((option) => (
						<label key={option.value} className={styles.sort_mode_option}>
							<input
								type="radio"
								name="sortMode"
								checked={sortMode === option.value}
								onChange={() => setSortMode(option.value)}
							/>
							{option.label}
						</label>
					))}
				</div>
			</div>
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
