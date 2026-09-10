"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clickable } from "@/components/ui/clickable";
import { AvatarPicker } from "@/components/account/avatar-picker/avatar-picker";
import { AvatarGroup } from "@/lib/avatars";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { useDictionary } from "@/lib/i18n/i18n-context";
import {
	saveOnboardingPreferences,
	saveOnboardingUsername,
} from "@/components/onboarding/onboarding-actions";
import styles from "./onboarding-wizard.module.sass";

type Props = {
	initial: {
		name: string | null;
		username: string | null;
		image: string | null;
		preferredLanguage: string;
		newsletterOptIn: boolean;
	};
	avatarGroups: AvatarGroup[];
};

export function OnboardingWizard({ initial, avatarGroups }: Props) {
	const dict = useDictionary();
	const router = useRouter();
	const [step, setStep] = useState(0);
	// Falls back to `name` (from signup) only when no username yet (same order as display-name.ts). Editable here so user can confirm/change before save.
	const [username, setUsername] = useState(initial.username ?? initial.name ?? "");
	const [preferredLanguage, setPreferredLanguage] = useState(initial.preferredLanguage);
	const [newsletterOptIn, setNewsletterOptIn] = useState(initial.newsletterOptIn);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const STEPS = [
		dict.onboarding.steps.username,
		dict.onboarding.steps.avatar,
		dict.onboarding.steps.preferences,
	];

	function finish() {
		router.push("/account");
	}

	async function handleUsernameNext() {
		setIsSubmitting(true);
		try {
			await saveOnboardingUsername(username.trim() || null);
			setStep(1);
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleFinish() {
		setIsSubmitting(true);
		try {
			await saveOnboardingPreferences({ preferredLanguage, newsletterOptIn });
			finish();
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.progress}>
				{STEPS.map((label, i) => (
					<span
						key={label}
						className={`${styles.dot} ${i === step ? styles.dot_active : ""} ${i < step ? styles.dot_done : ""}`}
					/>
				))}
			</div>

			{step === 0 && (
				<div className={styles.step}>
					<h1 className={styles.title}>{dict.onboarding.usernameStep.title}</h1>
					<p className={styles.subtitle}>{dict.onboarding.usernameStep.subtitle}</p>
					<input
						className={styles.input}
						type="text"
						value={username}
						placeholder={dict.onboarding.usernameStep.placeholder}
						onChange={(e) => setUsername(e.target.value)}
						autoFocus
					/>
					<div className={styles.actions}>
						<Clickable className={styles.skip_button} onClick={() => setStep(1)}>
							{dict.common.skip}
						</Clickable>
						<Clickable
							className={styles.next_button}
							disabled={isSubmitting}
							onClick={handleUsernameNext}>
							{dict.common.continue}
						</Clickable>
					</div>
				</div>
			)}

			{step === 1 && (
				<div className={styles.step}>
					<h1 className={styles.title}>{dict.onboarding.avatarStep.title}</h1>
					<p className={styles.subtitle}>{dict.onboarding.avatarStep.subtitle}</p>
					<div className={styles.avatar_picker}>
						<AvatarPicker initialSrc={initial.image} groups={avatarGroups} />
					</div>
					<div className={styles.actions}>
						<Clickable className={styles.skip_button} onClick={() => setStep(0)}>
							{dict.common.back}
						</Clickable>
						<Clickable className={styles.next_button} onClick={() => setStep(2)}>
							{dict.common.continue}
						</Clickable>
					</div>
				</div>
			)}

			{step === 2 && (
				<div className={styles.step}>
					<h1 className={styles.title}>{dict.onboarding.preferencesStep.title}</h1>
					<label className={styles.field}>
						{dict.account.preferredLanguage}
						<select
							className={styles.input}
							value={preferredLanguage}
							onChange={(e) => setPreferredLanguage(e.target.value)}>
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
							onChange={(e) => setNewsletterOptIn(e.target.checked)}
						/>
						{dict.account.newsletterOptIn}
					</label>
					<div className={styles.actions}>
						<Clickable className={styles.skip_button} onClick={finish}>
							{dict.common.skip}
						</Clickable>
						<Clickable
							className={styles.next_button}
							disabled={isSubmitting}
							onClick={handleFinish}>
							{isSubmitting ? dict.common.saving : dict.onboarding.finish}
						</Clickable>
					</div>
				</div>
			)}
		</div>
	);
}
