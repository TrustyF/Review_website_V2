"use client";
import { FormEvent, useState } from "react";
import { updateAccountSettings } from "@/components/account/account-actions";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import styles from "./account-settings-form.module.sass";

type Props = {
	initial: {
		preferredLanguage: string;
		newsletterOptIn: boolean;
		username: string | null;
	};
};

export function AccountSettingsForm({ initial }: Props) {
	const [preferredLanguage, setPreferredLanguage] = useState(
		initial.preferredLanguage,
	);
	const [newsletterOptIn, setNewsletterOptIn] = useState(
		initial.newsletterOptIn,
	);
	const [username, setUsername] = useState(initial.username ?? "");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [saved, setSaved] = useState(false);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setIsSubmitting(true);
		try {
			await updateAccountSettings({
				preferredLanguage,
				newsletterOptIn,
				username: username.trim() || null,
			});
			setSaved(true);
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form className={styles.form} onSubmit={handleSubmit}>
			<label className={styles.field}>
				Username
				<input
					className={styles.input}
					type="text"
					value={username}
					placeholder="Shown instead of your name if set"
					onChange={(e) => {
						setUsername(e.target.value);
						setSaved(false);
					}}
				/>
			</label>
			<label className={styles.field}>
				Preferred language
				<select
					className={styles.input}
					value={preferredLanguage}
					onChange={(e) => {
						setPreferredLanguage(e.target.value);
						setSaved(false);
					}}>
					{LANGUAGE_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</label>
			<label className={styles.checkbox_field}>
				<input
					type="checkbox"
					checked={newsletterOptIn}
					onChange={(e) => {
						setNewsletterOptIn(e.target.checked);
						setSaved(false);
					}}
				/>
				Subscribe to the newsletter
			</label>
			{saved && <div className={styles.saved}>Saved.</div>}
			<button
				type="submit"
				className={styles.submit_button}
				disabled={isSubmitting}>
				{isSubmitting ? "Saving…" : "Save"}
			</button>
		</form>
	);
}
