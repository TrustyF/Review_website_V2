"use client";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./mode-toggle.module.sass";

export type StatsMode = "titles" | "rating";

type Props = {
	mode: StatsMode;
	onModeChange: (mode: StatsMode) => void;
};

type PillToggleProps<T extends string> = {
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
};

// Pill group for a StatsSection's `actions` slot (top-right of its heading).
export function PillToggle<T extends string>({
	value,
	options,
	onChange,
}: PillToggleProps<T>) {
	return (
		<div className={styles.toggle}>
			{options.map((option) => (
				<Clickable
					key={option.value}
					className={styles.toggle_option}
					aria-pressed={value === option.value}
					data-active={value === option.value}
					onClick={() => onChange(option.value)}>
					{option.label}
				</Clickable>
			))}
		</div>
	);
}

// Titles/Avg rating pair — shared by the world map, top people and bar lists.
export function ModeToggle({ mode, onModeChange }: Props) {
	const dict = useDictionary();

	return (
		<PillToggle
			value={mode}
			options={[
				{ value: "titles", label: dict.stats.modeToggle.titles },
				{ value: "rating", label: dict.stats.modeToggle.rating },
			]}
			onChange={onModeChange}
		/>
	);
}
