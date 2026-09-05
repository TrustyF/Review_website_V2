"use client";
import { ChangeEvent, FormEvent, useState } from "react";
import { Clickable } from "@/components/ui/clickable";
import { AssetBrowser } from "@/components/media/asset-browser/asset-browser";
import styles from "./digest-banner.module.sass";
import {
	DigestBannerOverride,
	updateDigestBannerOverride,
	uploadDigestBannerImage,
} from "./digest-banner-actions";

type Props = {
	initial: DigestBannerOverride;
	// Lets the parent refresh the preview iframe once a save actually lands.
	onSaved?: () => void;
};

// Empty override falls back to the automatic per-send behavior in
// send-weekly-digest.ts: the featured media's own backdrop, "Weekly Digest"
// headline, and the send date as subtitle.
export function DigestBannerForm({ initial, onSaved }: Props) {
	const [image, setImage] = useState(initial.image ?? "");
	const [headline, setHeadline] = useState(initial.headline ?? "");
	const [subtitle, setSubtitle] = useState(initial.subtitle ?? "");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [isBrowserOpen, setIsBrowserOpen] = useState(false);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);
		setSaved(false);
		try {
			await updateDigestBannerOverride({
				image,
				headline,
				subtitle,
			});
			setSaved(true);
			onSaved?.();
		} catch {
			setError("Failed to save. Try again.");
		} finally {
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
			setImage(await uploadDigestBannerImage(formData));
		} catch {
			setError("Failed to upload image. Try again.");
		} finally {
			setIsUploading(false);
		}
	}

	function handleClear() {
		setImage("");
		setHeadline("");
		setSubtitle("");
	}

	return (
		<form className={styles.form} onSubmit={handleSubmit}>
			<label className={styles.field}>
				Banner image URL
				<input
					className={styles.input}
					type="text"
					placeholder="https://… (leave empty to use the featured title's backdrop)"
					value={image}
					onChange={(e) => setImage(e.target.value)}
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
			<Clickable
				className={styles.browse_button}
				onClick={() => setIsBrowserOpen(true)}>
				Browse posters &amp; banners…
			</Clickable>
			{isUploading && <div className={styles.uploading}>Uploading…</div>}
			<label className={styles.field}>
				Headline
				<input
					className={styles.input}
					type="text"
					placeholder="Weekly Digest"
					value={headline}
					onChange={(e) => setHeadline(e.target.value)}
				/>
			</label>
			<label className={styles.field}>
				Subtitle
				<input
					className={styles.input}
					type="text"
					placeholder="Defaults to the send date"
					value={subtitle}
					onChange={(e) => setSubtitle(e.target.value)}
				/>
			</label>
			{error && <div className={styles.error}>{error}</div>}
			{saved && !error && <div className={styles.saved}>Saved.</div>}
			<div className={styles.button_row}>
				<button
					type="submit"
					className={styles.submit_button}
					disabled={isSubmitting}>
					{isSubmitting ? "Saving…" : "Save"}
				</button>
				<Clickable
					className={styles.clear_button}
					onClick={handleClear}
					disabled={isSubmitting}>
					Clear override
				</Clickable>
			</div>
			{/* Always mounted (visibility toggled via isOpen) so its search/selection state survives being closed and reopened. */}
			<AssetBrowser
				isOpen={isBrowserOpen}
				onSelect={(url) => {
					setImage(url);
					setIsBrowserOpen(false);
				}}
				onClose={() => setIsBrowserOpen(false)}
			/>
		</form>
	);
}
