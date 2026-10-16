"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Languages, Mail, UserRound } from "lucide-react";
import { updateAccountSettings } from "@/components/account/account-actions";
import { LanguagePicker } from "@/components/account/language-picker/language-picker";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./account-settings-form.module.sass";

type Props = {
	initial: {
		preferredLanguage: string;
		newsletterOptIn: boolean;
		listAddEmailOptIn: boolean;
		showSpoilers: boolean;
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
	const [showSpoilers, setShowSpoilers] = useState(initial.showSpoilers);
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
				showSpoilers,
				username: username.trim() || null,
			});
			setSaved(true);
			// Picks up the just-saved locale/spoiler cookies immediately, instead of
			// waiting for the next full navigation.
			router.refresh();
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form className={styles.form} onSubmit={handleSubmit}>
			<section className={styles.section}>
				<h2 className={styles.section_title}>
					<UserRound size={18} className={styles.section_icon} />
					{dict.account.profileSection}
				</h2>
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
			</section>

			<section className={styles.section}>
				<h2 className={styles.section_title}>
					<Languages size={18} className={styles.section_icon} />
					{dict.account.languageSection}
				</h2>
				<div className={styles.field}>
					{dict.account.preferredLanguage}
					<LanguagePicker
						value={preferredLanguage}
						onChange={(value) => {
							setPreferredLanguage(value);
							setSaved(false);
						}}
					/>
				</div>
			</section>

			<section className={styles.section}>
				<h2 className={styles.section_title}>
					<BookOpen size={18} className={styles.section_icon} />
					{dict.account.readingSection}
				</h2>
				<label className={styles.checkbox_field}>
					<input
						type="checkbox"
						checked={showSpoilers}
						onChange={(e) => {
							setShowSpoilers(e.target.checked);
							setSaved(false);
						}}
					/>
					<span className={styles.option_text}>
						<span>{dict.account.showSpoilers}</span>
						<span className={styles.option_description}>
							{dict.account.showSpoilersDescription}
						</span>
					</span>
				</label>
			</section>

			<section className={styles.section}>
				<h2 className={styles.section_title}>
					<Mail size={18} className={styles.section_icon} />
					{dict.account.emailsSection}
				</h2>
				<label className={styles.checkbox_field}>
					<input
						type="checkbox"
						checked={newsletterOptIn}
						onChange={(e) => {
							setNewsletterOptIn(e.target.checked);
							setSaved(false);
						}}
					/>
					<span className={styles.option_text}>
						<span>{dict.account.newsletterOptIn}</span>
						<span className={styles.option_description}>
							{dict.account.newsletterOptInDescription}
						</span>
					</span>
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
					<span className={styles.option_text}>
						<span>{dict.account.listAddEmailOptIn}</span>
						<span className={styles.option_description}>
							{dict.account.listAddEmailOptInDescription}
						</span>
					</span>
				</label>
			</section>

			<div className={styles.save_row}>
				<button
					type="submit"
					className={styles.submit_button}
					disabled={isSubmitting}>
					{isSubmitting ? dict.common.saving : dict.common.save}
				</button>
				{saved && <span className={styles.saved}>{dict.common.saved}</span>}
			</div>
		</form>
	);
}
