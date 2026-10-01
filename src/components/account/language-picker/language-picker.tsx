"use client";
import { Clickable } from "@/components/ui/clickable";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import styles from "./language-picker.module.sass";

type Props = {
	value: string;
	onChange: (value: string) => void;
};

// Flag buttons shared by the onboarding language step and account settings.
export function LanguagePicker({ value, onChange }: Props) {
	return (
		<div className={styles.options}>
			{LANGUAGE_OPTIONS.map((option) => (
				<Clickable
					key={option.value}
					className={`${styles.option} ${option.value === value ? styles.option_active : ""}`}
					aria-pressed={option.value === value}
					onClick={() => onChange(option.value)}>
					<span className={styles.flag}>{option.flag}</span>
					<span>{option.label}</span>
				</Clickable>
			))}
		</div>
	);
}
