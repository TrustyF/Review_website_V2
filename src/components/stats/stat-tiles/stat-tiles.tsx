"use client";
import type { ReactNode } from "react";
import { useDictionary } from "@/lib/i18n/i18n-context";
import type { StatsData } from "@/components/stats/stats-types";
import styles from "./stat-tiles.module.sass";

type Props = {
	totals: StatsData["totals"];
};

// A number followed by a unit word/abbreviation, spaced via CSS (.unit)
// rather than a literal string space, which reads too wide in the mono font.
function valueWithUnit(value: string | number, unit: string): ReactNode {
	return (
		<>
			{value}
			<span className={styles.unit}>{unit}</span>
		</>
	);
}

export function StatTiles({ totals }: Props) {
	const dict = useDictionary();
	const movieHours = Math.round(totals.movieMinutesWatched / 60);

	const tiles: { key: string; label: string; value: ReactNode }[] = [
		{
			key: "titles",
			label: dict.stats.tiles.titles,
			value: totals.titles.toLocaleString(),
		},
		{
			key: "longestStreak",
			label: dict.stats.tiles.longestStreak,
			value: valueWithUnit(
				totals.longestStreakDays,
				dict.stats.tiles.daysUnit(totals.longestStreakDays),
			),
		},
		{
			key: "reviewsWritten",
			label: dict.stats.tiles.reviewsWritten,
			value: totals.reviewsWritten.toLocaleString(),
		},
		{
			key: "avgRating",
			label: dict.stats.tiles.avgRating,
			value:
				totals.avgRating == null ? "—" : `${totals.avgRating.toFixed(1)}/10`,
		},
		{
			key: "movieTime",
			label: dict.stats.tiles.movieTimeWatched,
			value: valueWithUnit(
				movieHours.toLocaleString(),
				dict.stats.tiles.hoursUnit,
			),
		},
	];

	return (
		<div className={styles.grid}>
			{tiles.map((tile) => (
				<div className={styles.tile} key={tile.key}>
					<span className={styles.value}>{tile.value}</span>
					<span className={styles.label}>{tile.label}</span>
				</div>
			))}
		</div>
	);
}
