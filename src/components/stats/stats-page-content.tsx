"use client";
import { useState } from "react";
import { HorizontalBarList } from "@/components/stats/horizontal-bar-list/horizontal-bar-list";
import { VerticalBarChart } from "@/components/stats/vertical-bar-chart/vertical-bar-chart";
import { StatsSection } from "@/components/stats/stats-section/stats-section";
import {
	WorldMap,
	type WorldMapMode,
} from "@/components/stats/world-map/world-map";
import {
	globalRatingMean,
	weightedCountryRating,
} from "@/components/stats/world-map/rating-weighting";
import {
	ModeToggle,
	type StatsMode,
} from "@/components/stats/mode-toggle/mode-toggle";
import { TopPeople } from "@/components/stats/top-people/top-people";
import { countryFlagEmoji } from "@/lib/country-flag";
import { useDictionary } from "@/lib/i18n/i18n-context";
import {
	MEDIA_TYPE_LABEL_KEY,
	type StatsData,
} from "@/components/stats/stats-types";
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

// Same reasoning as the world map's own MIN_SAMPLE_FOR_RATING — a genre with
// one or two rated titles shouldn't be able to top the avg-rating ranking.
const MIN_SAMPLE_FOR_GENRE_RATING = 3;
const TOP_GENRES_COUNT = 7;

// Fixed bar-scale endpoints for every avg-rating list — edit directly.
// Separate from the world map's own RATING_SCALE_MIN/MAX (colors a choropleth).
const RATING_BAR_SCALE_MIN = 3;
const RATING_BAR_SCALE_MAX = 9;

type Props = {
	stats: StatsData;
};

export function StatsPageContent({ stats }: Props) {
	const dict = useDictionary();
	const [mapMode, setMapMode] = useState<WorldMapMode>("count");
	const [peopleMode, setPeopleMode] = useState<StatsMode>("titles");
	const [typeMode, setTypeMode] = useState<StatsMode>("titles");
	const [genreMode, setGenreMode] = useState<StatsMode>("titles");

	// Fixed categorical order either way — a rating doesn't re-rank this one,
	// it only swaps what each bar's own length/value represents.
	const typeItems = stats.byType.map((entry, i) => ({
		key: entry.type,
		label: dict.nav.search.typeLabels[MEDIA_TYPE_LABEL_KEY[entry.type]],
		value: typeMode === "rating" ? (entry.avgRating ?? 0) : entry.count,
		color: CHART_COLOR_VARS[i]!,
	}));

	// Rating mode re-ranks every genre by avg rating, same as the world map's
	// own top-countries list — not just the top-by-count 7 re-labeled.
	const genreItems = (
		genreMode === "rating"
			? stats.topGenres
					.filter(
						(g) =>
							g.avgRating != null && g.count >= MIN_SAMPLE_FOR_GENRE_RATING,
					)
					.sort((a, b) => b.avgRating! - a.avgRating!)
			: stats.topGenres.slice().sort((a, b) => b.count - a.count)
	)
		.slice(0, TOP_GENRES_COUNT)
		.map((g) => ({
			key: g.name,
			label: g.name,
			value: genreMode === "rating" ? g.avgRating! : g.count,
			color: "var(--brand)",
			href: `/genre/${encodeURIComponent(g.name)}`,
		}));

	// Mirrors the map's own mode — count mode reuses the server-ranked top 8,
	// rating mode re-ranks every country by the same weighted rating the map colors by.
	const ratingMean = globalRatingMean(stats.worldMap);
	const countryItems =
		mapMode === "rating"
			? stats.worldMap
					.map((c) => ({
						...c,
						weighted: weightedCountryRating(c, ratingMean),
					}))
					.filter(
						(c): c is typeof c & { weighted: number } => c.weighted != null,
					)
					.sort((a, b) => b.weighted - a.weighted)
					.slice(0, 8)
					.map((c) => ({
						key: c.code,
						label: c.name,
						value: c.weighted,
						color: "var(--brand)",
						prefix: <span>{countryFlagEmoji(c.code)}</span>,
						href: `/country/${c.code}`,
					}))
			: stats.topCountries.map((c) => ({
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
				<StatsSection
					title={dict.stats.mediaByType.title}
					actions={<ModeToggle mode={typeMode} onModeChange={setTypeMode} />}>
					{typeMode === "rating" ? (
						<HorizontalBarList
							items={typeItems}
							valueFormatter={(v) => `${v.toFixed(1)}/10`}
							scaleMin={RATING_BAR_SCALE_MIN}
							scaleMax={RATING_BAR_SCALE_MAX}
						/>
					) : (
						<HorizontalBarList items={typeItems} />
					)}
				</StatsSection>

				<StatsSection
					title={dict.stats.topGenres.title}
					actions={<ModeToggle mode={genreMode} onModeChange={setGenreMode} />}>
					{genreMode === "rating" ? (
						<HorizontalBarList
							items={genreItems}
							valueFormatter={(v) => `${v.toFixed(1)}/10`}
							scaleMin={RATING_BAR_SCALE_MIN}
							scaleMax={RATING_BAR_SCALE_MAX}
						/>
					) : (
						<HorizontalBarList items={genreItems} />
					)}
				</StatsSection>
			</div>

			<StatsSection
				title={dict.stats.worldMap.title}
				subtitle={dict.stats.worldMap.subtitle}
				actions={
					<ModeToggle
						mode={mapMode === "count" ? "titles" : "rating"}
						onModeChange={(m) =>
							setMapMode(m === "titles" ? "count" : "rating")
						}
					/>
				}>
				<div className={styles.map_layout}>
					<WorldMap data={stats.worldMap} mode={mapMode} />
					<div className={styles.top_countries}>
						<h3 className={styles.top_countries_title}>
							{dict.stats.worldMap.topCountriesTitle}
						</h3>
						{mapMode === "rating" ? (
							<HorizontalBarList
								items={countryItems}
								valueFormatter={(v) => `${v.toFixed(1)}/10`}
								scaleMin={RATING_BAR_SCALE_MIN}
								scaleMax={RATING_BAR_SCALE_MAX}
							/>
						) : (
							<HorizontalBarList items={countryItems} />
						)}
					</div>
				</div>
			</StatsSection>

			<StatsSection
				title={dict.stats.topPeople.title}
				actions={<ModeToggle mode={peopleMode} onModeChange={setPeopleMode} />}>
				<TopPeople topPeople={stats.topPeople} mode={peopleMode} />
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
