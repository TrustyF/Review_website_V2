"use client";
import type { MediaType } from "@prisma/client";
import { HorizontalBarList } from "@/components/stats/horizontal-bar-list/horizontal-bar-list";
import { VerticalBarChart } from "@/components/stats/vertical-bar-chart/vertical-bar-chart";
import { StatsSection } from "@/components/stats/stats-section/stats-section";
import { WorldMap } from "@/components/stats/world-map/world-map";
import { TopPeople } from "@/components/stats/top-people/top-people";
import { countryFlagEmoji } from "@/lib/country-flag";
import { useDictionary } from "@/lib/i18n/i18n-context";
import type { StatsData } from "@/components/stats/stats-types";
import styles from "./stats-page-content.module.sass";

const CHART_COLOR_VARS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--chart-6)",
	"var(--chart-7)",
] as const;

const TYPE_LABEL_KEY: Record<
	MediaType,
	"movie" | "short" | "tvShow" | "manga" | "comic" | "game" | "book"
> = {
	MOVIE: "movie",
	SHORT: "short",
	TVSHOW: "tvShow",
	MANGA: "manga",
	COMIC: "comic",
	GAME: "game",
	BOOK: "book",
};

type Props = {
	stats: StatsData;
};

export function StatsPageContent({ stats }: Props) {
	const dict = useDictionary();

	const typeItems = stats.byType.map((entry, i) => ({
		key: entry.type,
		label: dict.nav.search.typeLabels[TYPE_LABEL_KEY[entry.type]],
		value: entry.count,
		color: CHART_COLOR_VARS[i]!,
	}));

	const genreItems = stats.topGenres.map((g) => ({
		key: g.name,
		label: g.name,
		value: g.count,
		color: "var(--brand)",
	}));

	const countryItems = stats.topCountries.map((c) => ({
		key: c.code,
		label: c.name,
		value: c.count,
		color: "var(--brand)",
		prefix: <span>{countryFlagEmoji(c.code)}</span>,
		href: `/country/${c.code}`,
	}));

	// Reuses media.ratingDistribution's existing pluralized copy — same
	// tier-bucket histogram shape as that credited-media chart, just sitewide.
	const ratingItems = stats.ratingHistogram.counts.map((count, tier) => {
		const tierLabel = `${tier}–${tier + 1}`;
		return {
			key: `tier-${tier}`,
			tick: String(tier),
			value: count,
			ariaLabel: dict.media.ratingDistribution.ratedAriaLabel(count, tierLabel),
			tooltip: dict.media.ratingDistribution.ratedTooltip(count, tierLabel),
		};
	});
	ratingItems.push({
		key: "unrated",
		tick: "—",
		value: stats.ratingHistogram.unrated,
		ariaLabel: dict.media.ratingDistribution.unratedAriaLabel(
			stats.ratingHistogram.unrated,
		),
		tooltip: dict.media.ratingDistribution.unratedTooltip(
			stats.ratingHistogram.unrated,
		),
	});

	const yearItems = stats.reviewsByYear.map((y) => {
		const tooltip = dict.stats.reviewsByYear.tooltip(y.count, y.year);
		return {
			key: String(y.year),
			tick: String(y.year),
			value: y.count,
			ariaLabel: tooltip,
			tooltip,
		};
	});

	const decadeItems = stats.mediaByDecade.map((d) => {
		const label = dict.stats.mediaByDecade.tick(d.decade);
		const tooltip = dict.stats.mediaByDecade.tooltip(d.count, label);
		return {
			key: String(d.decade),
			tick: label,
			value: d.count,
			ariaLabel: tooltip,
			tooltip,
		};
	});

	return (
		<div className={styles.sections}>
			<div className={styles.type_genre_row}>
				<StatsSection title={dict.stats.mediaByType.title}>
					<HorizontalBarList items={typeItems} />
				</StatsSection>

				<StatsSection title={dict.stats.topGenres.title}>
					<HorizontalBarList items={genreItems} />
				</StatsSection>
			</div>

			<StatsSection
				title={dict.stats.worldMap.title}
				subtitle={dict.stats.worldMap.subtitle}>
				<div className={styles.map_layout}>
					<WorldMap data={stats.worldMap} />
					<div className={styles.top_countries}>
						<h3 className={styles.top_countries_title}>
							{dict.stats.worldMap.topCountriesTitle}
						</h3>
						<HorizontalBarList items={countryItems} />
					</div>
				</div>
			</StatsSection>

			<StatsSection title={dict.stats.topPeople.title}>
				<TopPeople topPeople={stats.topPeople} />
			</StatsSection>

			<div className={styles.chart_row}>
				<StatsSection title={dict.stats.ratingDistribution.title}>
					<VerticalBarChart items={ratingItems} color="var(--warning)" />
				</StatsSection>

				<StatsSection title={dict.stats.reviewsByYear.title}>
					<VerticalBarChart items={yearItems} color="var(--link)" />
				</StatsSection>

				<StatsSection title={dict.stats.mediaByDecade.title}>
					<VerticalBarChart items={decadeItems} color="var(--brand)" />
				</StatsSection>
			</div>
		</div>
	);
}
