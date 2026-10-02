"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Languages, LayoutList, LucideProvider, MailPlus } from "lucide-react";
import { MovieIcon } from "@/components/icons/movie-icon";
import { WatchlistIcon } from "@/components/icons/watchlist-icon";
import { Clickable } from "@/components/ui/clickable";
import { AvatarPicker } from "@/components/account/avatar-picker/avatar-picker";
import { AvatarGroup } from "@/lib/avatars";
import { LanguagePicker } from "@/components/account/language-picker/language-picker";
import { dictionaries, useDictionary } from "@/lib/i18n/i18n-context";
import type { Locale } from "@/lib/i18n/get-locale";
import {
	saveOnboardingEmailPreferences,
	saveOnboardingLanguage,
	saveOnboardingUsername,
} from "@/components/onboarding/onboarding-actions";
import { parseOnboardingStep } from "@/components/onboarding/onboarding-step";
import styles from "./onboarding-wizard.module.sass";

type Props = {
	initial: {
		name: string | null;
		username: string | null;
		image: string | null;
		preferredLanguage: string;
		newsletterOptIn: boolean;
		listAddEmailOptIn: boolean;
	};
	avatarGroups: AvatarGroup[];
	initialStep: number;
};

type StepAction = { label: string; onClick: () => void; disabled?: boolean };

type StepProps = {
	active: boolean;
	title: string;
	subtitle?: string;
	children: ReactNode;
	leftAction?: StepAction;
	rightAction: StepAction;
};

// Every step stays mounted, stacked in one grid cell, so the wizard is as tall as its
// tallest step and the action row never moves; inactive ones are hidden and inert.
function OnboardingStep({
	active,
	title,
	subtitle,
	children,
	leftAction,
	rightAction,
}: StepProps) {
	return (
		<div
			className={`${styles.step} ${active ? "" : styles.step_hidden}`}
			inert={!active}>
			<div className={styles.header}>
				<h1 className={styles.title}>{title}</h1>
				{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
			</div>
			<div className={styles.content}>{children}</div>
			<div
				className={`${styles.actions} ${leftAction ? "" : styles.actions_end}`}>
				{leftAction && (
					<Clickable
						className={styles.back_button}
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

export function OnboardingWizard({
	initial,
	avatarGroups,
	initialStep,
}: Props) {
	const contextDict = useDictionary();
	const router = useRouter();
	// Step lives in ?step= so browser back/forward moves between steps.
	const [step, setStep] = useState(initialStep);
	// Lowest step in this tab's history; below it, in-app Back can't use history.back().
	const entryStepRef = useRef(initialStep);

	useEffect(() => {
		function onPopState() {
			setStep(
				parseOnboardingStep(
					new URLSearchParams(window.location.search).get("step"),
				),
			);
		}
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	function goForward(next: number) {
		window.history.pushState(null, "", `?step=${next}`);
		setStep(next);
	}

	function goBack() {
		if (step > entryStepRef.current) {
			window.history.back();
			return;
		}
		// Landed directly on a later step (e.g. refresh) — no earlier entry to pop.
		const prev = step - 1;
		window.history.replaceState(null, "", `?step=${prev}`);
		entryStepRef.current = prev;
		setStep(prev);
	}
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
	const [listAddEmailOptIn, setListAddEmailOptIn] = useState(
		initial.listAddEmailOptIn,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	// Replaces autoFocus, which fires on mount while this step is still hidden.
	const usernameInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (step === 1) usernameInputRef.current?.focus();
	}, [step]);

	const STEPS = [
		dict.onboarding.steps.language,
		dict.onboarding.steps.username,
		dict.onboarding.steps.avatar,
		dict.onboarding.steps.preferences,
		dict.onboarding.steps.tour,
	];

	const tour = dict.onboarding.tourStep;
	const TOUR_ITEMS = [
		{ key: "browse", Icon: MovieIcon, ...tour.browse },
		{ key: "reviews", Icon: LayoutList, ...tour.reviews },
		{ key: "recommendations", Icon: MailPlus, ...tour.recommendations },
		{ key: "watchlist", Icon: WatchlistIcon, ...tour.watchlist },
	];

	async function handleLanguageNext() {
		setIsSubmitting(true);
		try {
			await saveOnboardingLanguage(preferredLanguage);
			// Switches the wizard's own dict immediately; refresh below re-syncs
			// the cookie for the rest of the site, without the wizard waiting on it.
			setConfirmedLocale(preferredLanguage as Locale);
			goForward(1);
			router.refresh();
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleUsernameNext() {
		setIsSubmitting(true);
		try {
			await saveOnboardingUsername(username.trim() || null);
			goForward(2);
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handlePreferencesNext() {
		setIsSubmitting(true);
		try {
			await saveOnboardingEmailPreferences({
				newsletterOptIn,
				listAddEmailOptIn,
			});
			goForward(4);
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

			<div className={styles.steps}>
				<OnboardingStep
					active={step === 0}
					title={dict.onboarding.languageStep.title}
					subtitle={dict.onboarding.languageStep.subtitle}
					rightAction={{
						label: dict.common.continue,
						onClick: handleLanguageNext,
						disabled: isSubmitting,
					}}>
					<div className={styles.field}>
						{dict.account.preferredLanguage}
						<LanguagePicker
							value={preferredLanguage}
							onChange={setPreferredLanguage}
						/>
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

				<OnboardingStep
					active={step === 1}
					title={dict.onboarding.usernameStep.title}
					subtitle={dict.onboarding.usernameStep.subtitle}
					leftAction={{ label: dict.common.back, onClick: goBack }}
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
						ref={usernameInputRef}
					/>
				</OnboardingStep>

				<OnboardingStep
					active={step === 2}
					title={dict.onboarding.avatarStep.title}
					subtitle={dict.onboarding.avatarStep.subtitle}
					leftAction={{ label: dict.common.back, onClick: goBack }}
					rightAction={{
						label: dict.common.continue,
						onClick: () => goForward(3),
					}}>
					<div className={styles.avatar_picker}>
						<AvatarPicker
							initialSrc={initial.image}
							groups={avatarGroups}
							alwaysShowEdit
						/>
					</div>
				</OnboardingStep>

				<OnboardingStep
					active={step === 3}
					title={dict.onboarding.preferencesStep.title}
					subtitle={dict.onboarding.preferencesStep.subtitle}
					leftAction={{ label: dict.common.back, onClick: goBack }}
					rightAction={{
						label: isSubmitting ? dict.common.saving : dict.common.continue,
						onClick: handlePreferencesNext,
						disabled: isSubmitting,
					}}>
					<label className={styles.checkbox_field}>
						<input
							type="checkbox"
							checked={newsletterOptIn}
							onChange={(e) => setNewsletterOptIn(e.target.checked)}
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
							onChange={(e) => setListAddEmailOptIn(e.target.checked)}
						/>
						<span className={styles.option_text}>
							<span>{dict.account.listAddEmailOptIn}</span>
							<span className={styles.option_description}>
								{dict.account.listAddEmailOptInDescription}
							</span>
						</span>
					</label>
				</OnboardingStep>

				<OnboardingStep
					active={step === 4}
					title={tour.title}
					subtitle={tour.subtitle}
					leftAction={{ label: dict.common.back, onClick: goBack }}
					rightAction={{
						label: dict.onboarding.finish,
						onClick: () => router.push("/account"),
					}}>
					{/* Same stroke handling as the navbar, so lucide and custom icons match. */}
					<LucideProvider strokeWidth={1.5} absoluteStrokeWidth>
						<ul className={styles.tour_list}>
							{TOUR_ITEMS.map(({ key, Icon, title, body }) => (
								<li key={key} className={styles.tour_item}>
									<Icon size={20} className={styles.tour_icon} />
									<span className={styles.option_text}>
										<span>{title}</span>
										<span className={styles.option_description}>{body}</span>
									</span>
								</li>
							))}
						</ul>
					</LucideProvider>
				</OnboardingStep>
			</div>
		</div>
	);
}
