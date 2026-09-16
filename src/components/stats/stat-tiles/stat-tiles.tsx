"use client";
import { useDictionary } from "@/lib/i18n/i18n-context";
import type { StatsData } from "@/components/stats/stats-types";
import styles from "./stat-tiles.module.sass";

type Props = {
	totals: StatsData["totals"];
};

export function StatTiles({ totals }: Props) {
	const dict = useDictionary();
	const movieHours = Math.round(totals.movieMinutesWatched / 60);

	const tiles: { key: string; label: string; value: string }[] = [
		{
			key: "titles",
			label: dict.stats.tiles.titles,
			value: totals.titles.toLocaleString(),
		},
		{
			key: "rated",
			label: dict.stats.tiles.rated,
			value: totals.rated.toLocaleString(),
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
			value: `${movieHours.toLocaleString()} h`,
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
