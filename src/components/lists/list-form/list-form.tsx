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
	// null = a normal, publicly-listed list.
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
	// Edit page's "Delete list" button — a separate destructive action, not a form field.
	extra?: ReactNode;
	// Hides the "Recommend to" picker, keeping initial.targetUserId fixed — used when the form is reached from that user's own admin page and the target is already implied.
	hideRecommendTo?: boolean;
};

// Shared by /lists/new and /lists/[id]/edit; only onSubmit differs. Thumbnail can be a pasted URL or an uploaded file — both just set the same thumbnailUrl state.
export function ListForm({ initial, submitLabel, onSubmit, extra, hideRecommendTo }: Props) {
	const [title, setTitle] = useState(initial.title);
	const [description, setDescription] = useState(initial.description);
	const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnailUrl);
	const [sortMode, setSortMode] = useState(initial.sortMode);
	const [targetUserId, setTargetUserId] = useState(initial.targetUserId);
	const [targets, setTargets] = useState<RecommendationTargetOption[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetched on mount rather than passed as a prop, to keep both call sites as thin wrappers.
	useEffect(() => {
		if (hideRecommendTo) return;
		listRecommendationTargets().then(setTargets);
	}, [hideRecommendTo]);

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
		e.target.value = ""; // lets the same file be re-picked
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
				// Plain <img>, not next/image — arbitrary pasted host.
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={thumbnailUrl.trim()}
					alt=""
					className={styles.thumbnail_preview}
				/>
			)}
			{!hideRecommendTo && (
				<div className={styles.field}>
					Recommend to
					<UserPicker options={targets} value={targetUserId} onChange={setTargetUserId} />
					{targetUserId && (
						<span className={styles.recommend_hint}>
							Only this account (and admins) will be able to see this list.
						</span>
					)}
				</div>
			)}
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
