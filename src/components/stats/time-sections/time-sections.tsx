"use client";
import { CalendarHeatmap } from "@/components/stats/calendar-heatmap/calendar-heatmap";
import {
	RatingLineChart,
	ratingAxis,
} from "@/components/stats/rating-line-chart/rating-line-chart";
import { StackedAreaChart } from "@/components/stats/stacked-area-chart/stacked-area-chart";
import { StatsSection } from "@/components/stats/stats-section/stats-section";
import type { StatsData } from "@/components/stats/stats-types";
import { TimeScatter } from "@/components/stats/time-scatter/time-scatter";
import { useDictionary, useLocale } from "@/lib/i18n/i18n-context";

// Fixed order: the biggest genre overall takes the first slot.
const GENRE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--chart-7)",
];
const OTHER_COLOR = "color-mix(in srgb, var(--accent2) 45%, transparent)";
const RATING_COLOR = "var(--chart-1)";

type Props = {
	timeline: StatsData["timeline"];
};

type CalendarProps = {
	calendar: StatsData["timeline"]["calendar"];
};

const intlLocaleOf = (locale: string) => (locale === "fr" ? "fr-FR" : "en-US");

// Review calendar, rendered on its own near the top of the page.
export function CalendarSection({ calendar }: CalendarProps) {
	const dict = useDictionary();
	const locale = useLocale();
	const t = dict.stats.timeline.calendar;

	return (
		<StatsSection title={t.title}>
			<CalendarHeatmap
				start={calendar.start}
				counts={calendar.counts}
				titles={calendar.titles.map((day) =>
					day.map((d) => (locale === "fr" ? (d.titleFr ?? d.title) : d.title)),
				)}
				countLabel={dict.stats.titleCount}
				moreTitlesLabel={t.moreTitles}
				locale={intlLocaleOf(locale)}
				fewerLabel={dict.stats.worldMap.fewer}
				moreLabel={dict.stats.worldMap.more}
			/>
		</StatsSection>
	);
}

// Labels only each year's first quarter.
const quarterTicks = (keys: number[]) =>
	keys.map((k) => (k % 4 === 0 ? String(k / 4) : ""));

// The other "over time" charts on the stats page.
export function TimeSections({ timeline }: Props) {
	const dict = useDictionary();
	const locale = useLocale();
	const t = dict.stats.timeline;

	const genreSeries = timeline.genreShift.series.map((s, i) => ({
		key: s.name ?? "other",
		label: s.name ?? t.genreShift.other,
		color: s.name == null ? OTHER_COLOR : GENRE_COLORS[i]!,
		values: s.shares,
	}));
	// Thin quarters are skipped, so label each year's first kept quarter.
	const genreKeys = timeline.genreShift.keys;
	const genreTicks = genreKeys.map((k, i) =>
		i === 0 || Math.floor(genreKeys[i - 1]! / 4) !== Math.floor(k / 4)
			? String(Math.floor(k / 4))
			: "",
	);

	return (
		<>
			<StatsSection title={t.ratingOverTime.title}>
				<RatingLineChart
					series={[
						{
							key: "rating",
							label: t.ratingOverTime.title,
							color: RATING_COLOR,
							values: timeline.ratingByQuarter.map((b) => b.value),
						},
					]}
					ticks={quarterTicks(timeline.ratingByQuarter.map((b) => b.key))}
					{...ratingAxis(
						timeline.ratingByQuarter.flatMap((b) =>
							b.value != null ? [b.value] : [],
						),
					)}
					emptyText={t.notEnoughData}
				/>
			</StatsSection>

			<StatsSection title={t.genreShift.title} subtitle={t.genreShift.subtitle}>
				<StackedAreaChart
					series={genreSeries}
					ticks={genreTicks}
					formatPercent={dict.stats.vsPublic.scatter.percent}
					emptyText={t.notEnoughData}
				/>
			</StatsSection>

			<StatsSection title={t.age.title} subtitle={t.age.subtitle}>
				<TimeScatter
					points={timeline.age.map((a) => ({
						x: a.watched,
						y: a.released,
						label: locale === "fr" ? (a.titleFr ?? a.title) : a.title,
						detail: t.age.tooltip(
							Math.floor(a.released),
							Math.floor(a.watched),
						),
						href: `/media/${a.mediaId}`,
					}))}
					dotColor="var(--chart-1)"
					dotLabel={t.age.dot}
					xLabel={t.age.xLabel}
					yLabel={t.age.yLabel}
					sameYearLabel={t.age.sameYear}
					emptyText={t.notEnoughData}
				/>
			</StatsSection>
		</>
	);
}
