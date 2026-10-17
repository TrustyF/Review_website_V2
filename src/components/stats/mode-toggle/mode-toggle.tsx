"use client";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./mode-toggle.module.sass";

export type StatsMode = "titles" | "rating";

type Props = {
	mode: StatsMode;
	onModeChange: (mode: StatsMode) => void;
};

// Titles/Avg rating pill pair — shared by the world map and top people
// sections, rendered top-right of their StatsSection via its `actions` slot.
export function ModeToggle({ mode, onModeChange }: Props) {
	const dict = useDictionary();

	return (
		<div className={styles.toggle}>
			<Clickable
				className={styles.toggle_option}
				aria-pressed={mode === "titles"}
				data-active={mode === "titles"}
				onClick={() => onModeChange("titles")}>
				{dict.stats.modeToggle.titles}
			</Clickable>
			<Clickable
				className={styles.toggle_option}
				aria-pressed={mode === "rating"}
				data-active={mode === "rating"}
				onClick={() => onModeChange("rating")}>
				{dict.stats.modeToggle.rating}
			</Clickable>
		</div>
	);
}
