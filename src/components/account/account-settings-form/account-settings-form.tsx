"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { updateAccountSettings } from "@/components/account/account-actions";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./account-settings-form.module.sass";

type Props = {
	initial: {
		preferredLanguage: string;
		newsletterOptIn: boolean;
		listAddEmailOptIn: boolean;
		username: string | null;
	};
};

export function AccountSettingsForm({ initial }: Props) {
	const dict = useDictionary();
	const router = useRouter();
	const [preferredLanguage, setPreferredLanguage] = useState(
		initial.preferredLanguage,
	);
	const [newsletterOptIn, setNewsletterOptIn] = useState(
		initial.newsletterOptIn,
	);
	const [listAddEmailOptIn, setListAddEmailOptIn] = useState(
		initial.listAddEmailOptIn,
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
				listAddEmailOptIn,
				username: username.trim() || null,
			});
			setSaved(true);
			// Picks up the just-saved locale cookie immediately, instead of
			// waiting for the next full navigation.
			router.refresh();
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form className={styles.form} onSubmit={handleSubmit}>
			<label className={styles.field}>
				{dict.account.username}
				<input
					className={styles.input}
					type="text"
					value={username}
					placeholder={dict.account.usernamePlaceholder}
					onChange={(e) => {
						setUsername(e.target.value);
						setSaved(false);
					}}
				/>
			</label>
			<label className={styles.field}>
				{dict.account.preferredLanguage}
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
				{dict.account.newsletterOptIn}
			</label>
			<label className={styles.checkbox_field}>
				<input
					type="checkbox"
					checked={listAddEmailOptIn}
					onChange={(e) => {
						setListAddEmailOptIn(e.target.checked);
						setSaved(false);
					}}
				/>
				{dict.account.listAddEmailOptIn}
			</label>
			{saved && <div className={styles.saved}>{dict.common.saved}</div>}
			<button
				type="submit"
				className={styles.submit_button}
				disabled={isSubmitting}>
				{isSubmitting ? dict.common.saving : dict.common.save}
			</button>
		</form>
	);
}
