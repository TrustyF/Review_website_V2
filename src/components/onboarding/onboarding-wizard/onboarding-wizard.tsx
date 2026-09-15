"use client";
import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Clickable } from "@/components/ui/clickable";
import { AvatarPicker } from "@/components/account/avatar-picker/avatar-picker";
import { AvatarGroup } from "@/lib/avatars";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { dictionaries, useDictionary } from "@/lib/i18n/i18n-context";
import type { Locale } from "@/lib/i18n/get-locale";
import {
	saveOnboardingLanguage,
	saveOnboardingNewsletterOptIn,
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

type StepAction = { label: string; onClick: () => void; disabled?: boolean };

type StepProps = {
	title: string;
	subtitle?: string;
	children: ReactNode;
	leftAction?: StepAction;
	rightAction: StepAction;
};

// Fixed-height shell every step renders into, so the action row lands in the
// same spot regardless of how tall a given step's own content is.
function OnboardingStep({
	title,
	subtitle,
	children,
	leftAction,
	rightAction,
}: StepProps) {
	return (
		<div className={styles.step}>
			<div className={styles.header}>
				<h1 className={styles.title}>{title}</h1>
				{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
			</div>
			<div className={styles.content}>{children}</div>
			<div
				className={`${styles.actions} ${leftAction ? "" : styles.actions_end}`}>
				{leftAction && (
					<Clickable
						className={styles.skip_button}
						onClick={leftAction.onClick}>
						{leftAction.label}
					</Clickable>
				)}
				<Clickable
					className={styles.next_button}
					disabled={rightAction.disabled ?? false}
					onClick={rightAction.onClick}>
					{rightAction.label}
				</Clickable>
			</div>
		</div>
	);
}

export function OnboardingWizard({ initial, avatarGroups }: Props) {
	const contextDict = useDictionary();
	const router = useRouter();
	const [step, setStep] = useState(0);
	// Set on step 0's Continue so steps 1+ render translated immediately,
	// instead of flashing the old language while router.refresh() re-syncs the cookie.
	const [confirmedLocale, setConfirmedLocale] = useState<Locale | null>(null);
	const dict = confirmedLocale ? dictionaries[confirmedLocale] : contextDict;
	// Falls back to `name` (from signup) only when no username yet (same order as display-name.ts). Editable here so user can confirm/change before save.
	const [username, setUsername] = useState(
		initial.username ?? initial.name ?? "",
	);
	const [preferredLanguage, setPreferredLanguage] = useState(
		initial.preferredLanguage,
	);
	const [newsletterOptIn, setNewsletterOptIn] = useState(
		initial.newsletterOptIn,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const STEPS = [
		dict.onboarding.steps.language,
		dict.onboarding.steps.username,
		dict.onboarding.steps.avatar,
		dict.onboarding.steps.preferences,
	];

	function finish() {
		router.push("/account");
	}

	async function handleLanguageNext() {
		setIsSubmitting(true);
		try {
			await saveOnboardingLanguage(preferredLanguage);
			// Switches the wizard's own dict immediately; refresh below re-syncs
			// the cookie for the rest of the site, without the wizard waiting on it.
			setConfirmedLocale(preferredLanguage as Locale);
			router.refresh();
			setStep(1);
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleUsernameNext() {
		setIsSubmitting(true);
		try {
			await saveOnboardingUsername(username.trim() || null);
			setStep(2);
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleFinish() {
		setIsSubmitting(true);
		try {
			await saveOnboardingNewsletterOptIn(newsletterOptIn);
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
				<OnboardingStep
					title={dict.onboarding.languageStep.title}
					subtitle={dict.onboarding.languageStep.subtitle}
					rightAction={{
						label: dict.common.continue,
						onClick: handleLanguageNext,
						disabled: isSubmitting,
					}}>
					<div className={styles.field}>
						{dict.account.preferredLanguage}
						<div className={styles.language_options}>
							{LANGUAGE_OPTIONS.map((option) => (
								<Clickable
									key={option.value}
									className={`${styles.language_option} ${option.value === preferredLanguage ? styles.language_option_active : ""}`}
									aria-pressed={option.value === preferredLanguage}
									onClick={() => setPreferredLanguage(option.value)}>
									<span className={styles.language_flag}>{option.flag}</span>
									<span>{option.label}</span>
								</Clickable>
							))}
						</div>
					</div>
					{preferredLanguage !== "en" && (
						<div className={styles.language_notice}>
							<Languages size={16} />
							{/* Always French: shown only once French is selected, regardless of the
							    dictionary's current locale (which may lag behind during the refresh). */}
							<span>
								Certains contenus comme les jeux vidéo et mangas ne sont pas
								traduits. Ils seront affichés en anglais.
							</span>
						</div>
					)}
				</OnboardingStep>
			)}

			{step === 1 && (
				<OnboardingStep
					title={dict.onboarding.usernameStep.title}
					subtitle={dict.onboarding.usernameStep.subtitle}
					leftAction={{ label: dict.common.back, onClick: () => setStep(0) }}
					rightAction={{
						label: dict.common.continue,
						onClick: handleUsernameNext,
						disabled: isSubmitting,
					}}>
					<input
						className={styles.input}
						type="text"
						value={username}
						placeholder={dict.onboarding.usernameStep.placeholder}
						onChange={(e) => setUsername(e.target.value)}
						autoFocus
					/>
				</OnboardingStep>
			)}

			{step === 2 && (
				<OnboardingStep
					title={dict.onboarding.avatarStep.title}
					subtitle={dict.onboarding.avatarStep.subtitle}
					leftAction={{ label: dict.common.back, onClick: () => setStep(1) }}
					rightAction={{ label: dict.common.continue, onClick: () => setStep(3) }}>
					<div className={styles.avatar_picker}>
						<AvatarPicker initialSrc={initial.image} groups={avatarGroups} />
					</div>
				</OnboardingStep>
			)}

			{step === 3 && (
				<OnboardingStep
					title={dict.onboarding.preferencesStep.title}
					leftAction={{ label: dict.common.skip, onClick: finish }}
					rightAction={{
						label: isSubmitting ? dict.common.saving : dict.onboarding.finish,
						onClick: handleFinish,
						disabled: isSubmitting,
					}}>
					<label className={styles.checkbox_field}>
						<input
							type="checkbox"
							checked={newsletterOptIn}
							onChange={(e) => setNewsletterOptIn(e.target.checked)}
						/>
						{dict.account.newsletterOptIn}
					</label>
				</OnboardingStep>
			)}
		</div>
	);
}
