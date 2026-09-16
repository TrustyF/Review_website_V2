"use client";
import { useState, useTransition } from "react";
import { getStats } from "@/components/stats/stats-actions";
import { StatTiles } from "@/components/stats/stat-tiles/stat-tiles";
import { StatsPageContent } from "@/components/stats/stats-page-content";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import type { StatsData } from "@/components/stats/stats-types";
import styles from "./stats-page-client.module.sass";

type Props = {
	initialStats: StatsData;
};

export function StatsPageClient({ initialStats }: Props) {
	const dict = useDictionary();
	const [stats, setStats] = useState(initialStats);
	const [isPending, startTransition] = useTransition();
	// Descending — most recent year first, "All" always leads.
	const years = [...stats.years].sort((a, b) => b - a);

	function selectYear(year: number | null) {
		if (year === stats.year) return;
		startTransition(async () => {
			setStats(await getStats(year));
		});
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.year_toggle}>
				<Clickable
					className={styles.year_option}
					aria-pressed={stats.year === null}
					data-active={stats.year === null}
					onClick={() => selectYear(null)}>
					{dict.stats.yearScope.all}
				</Clickable>
				{years.map((y) => (
					<Clickable
						key={y}
						className={styles.year_option}
						aria-pressed={stats.year === y}
						data-active={stats.year === y}
						onClick={() => selectYear(y)}>
						{y}
					</Clickable>
				))}
			</div>
			<div className={isPending ? styles.content_pending : undefined}>
				<StatTiles totals={stats.totals} />
				<StatsPageContent stats={stats} />
			</div>
		</div>
	);
}
