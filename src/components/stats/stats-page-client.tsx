"use client";
import { useState, useTransition } from "react";
import type { MediaType } from "@prisma/client";
import { getStats } from "@/components/stats/stats-actions";
import { StatTiles } from "@/components/stats/stat-tiles/stat-tiles";
import { StatsPageContent } from "@/components/stats/stats-page-content";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import {
	MEDIA_TYPE_LABEL_KEY,
	MEDIA_TYPE_ORDER,
	type StatsData,
} from "@/components/stats/stats-types";
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

	function selectScope(year: number | null, type: MediaType | null) {
		if (year === stats.year && type === stats.type) return;
		startTransition(async () => {
			setStats(await getStats(year, type));
		});
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.scope_toggle}>
				<div className={styles.scope_row}>
					<Clickable
						className={styles.scope_option}
						aria-pressed={stats.year === null}
						data-active={stats.year === null}
						onClick={() => selectScope(null, stats.type)}>
						{dict.stats.yearScope.all}
					</Clickable>
					{years.map((y) => (
						<Clickable
							key={y}
							className={styles.scope_option}
							aria-pressed={stats.year === y}
							data-active={stats.year === y}
							onClick={() => selectScope(y, stats.type)}>
							{y}
						</Clickable>
					))}
				</div>
				<div className={styles.scope_row}>
					<Clickable
						className={styles.scope_option}
						aria-pressed={stats.type === null}
						data-active={stats.type === null}
						onClick={() => selectScope(stats.year, null)}>
						{dict.stats.yearScope.all}
					</Clickable>
					{MEDIA_TYPE_ORDER.map((t) => (
						<Clickable
							key={t}
							className={styles.scope_option}
							aria-pressed={stats.type === t}
							data-active={stats.type === t}
							onClick={() => selectScope(stats.year, t)}>
							{dict.nav.search.typeLabels[MEDIA_TYPE_LABEL_KEY[t]]}
						</Clickable>
					))}
				</div>
			</div>
			<div className={isPending ? styles.content_pending : undefined}>
				<StatTiles totals={stats.totals} />
				<StatsPageContent stats={stats} />
			</div>
		</div>
	);
}
