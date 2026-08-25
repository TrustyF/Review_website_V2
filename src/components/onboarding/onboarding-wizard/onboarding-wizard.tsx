"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clickable } from "@/components/ui/clickable";
import { AvatarPicker } from "@/components/account/avatar-picker/avatar-picker";
import { AvatarGroup } from "@/lib/avatars";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import {
	saveOnboardingPreferences,
	saveOnboardingUsername,
} from "@/components/onboarding/onboarding-actions";
import styles from "./onboarding-wizard.module.sass";

type Props = {
	initial: {
		username: string | null;
		image: string | null;
		preferredLanguage: string;
		newsletterOptIn: boolean;
	};
	avatarGroups: AvatarGroup[];
};

const STEPS = ["Username", "Avatar", "Preferences"] as const;

export function OnboardingWizard({ initial, avatarGroups }: Props) {
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [username, setUsername] = useState(initial.username ?? "");
	const [preferredLanguage, setPreferredLanguage] = useState(initial.preferredLanguage);
	const [newsletterOptIn, setNewsletterOptIn] = useState(initial.newsletterOptIn);
	const [isSubmitting, setIsSubmitting] = useState(false);

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
					<h1 className={styles.title}>Pick a username</h1>
					<p className={styles.subtitle}>
						Shown instead of your name around the site. You can change this
						any time in account settings.
					</p>
					<input
						className={styles.input}
						type="text"
						value={username}
						placeholder="Your username"
						onChange={(e) => setUsername(e.target.value)}
						autoFocus
					/>
					<div className={styles.actions}>
						<Clickable className={styles.skip_button} onClick={() => setStep(1)}>
							Skip
						</Clickable>
						<Clickable
							className={styles.next_button}
							disabled={isSubmitting}
							onClick={handleUsernameNext}>
							Continue
						</Clickable>
					</div>
				</div>
			)}

			{step === 1 && (
				<div className={styles.step}>
					<h1 className={styles.title}>Pick a profile picture</h1>
					<p className={styles.subtitle}>Click the avatar to choose one.</p>
					<div className={styles.avatar_picker}>
						<AvatarPicker initialSrc={initial.image} groups={avatarGroups} />
					</div>
					<div className={styles.actions}>
						<Clickable className={styles.skip_button} onClick={() => setStep(0)}>
							Back
						</Clickable>
						<Clickable className={styles.next_button} onClick={() => setStep(2)}>
							Continue
						</Clickable>
					</div>
				</div>
			)}

			{step === 2 && (
				<div className={styles.step}>
					<h1 className={styles.title}>Language & newsletter</h1>
					<label className={styles.field}>
						Preferred language
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
						Subscribe to the newsletter
					</label>
					<div className={styles.actions}>
						<Clickable className={styles.skip_button} onClick={finish}>
							Skip
						</Clickable>
						<Clickable
							className={styles.next_button}
							disabled={isSubmitting}
							onClick={handleFinish}>
							{isSubmitting ? "Saving…" : "Finish"}
						</Clickable>
					</div>
				</div>
			)}
		</div>
	);
}
