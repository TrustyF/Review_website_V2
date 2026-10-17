"use client";
import { CalendarHeatmap } from "@/components/stats/calendar-heatmap/calendar-heatmap";
import { RatingLineChart } from "@/components/stats/rating-line-chart/rating-line-chart";
import { StackedAreaChart } from "@/components/stats/stacked-area-chart/stacked-area-chart";
import { StatsSection } from "@/components/stats/stats-section/stats-section";
import type { StatsData, TimeBin } from "@/components/stats/stats-types";
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
	// The calendar's year, or null for the last 12 months.
	year: number | null;
};

const intlLocaleOf = (locale: string) => (locale === "fr" ? "fr-FR" : "en-US");

// Review calendar, rendered on its own near the top of the page.
export function CalendarSection({ calendar, year }: CalendarProps) {
	const dict = useDictionary();
	const locale = useLocale();
	const t = dict.stats.timeline.calendar;
	const titles = calendar.counts.reduce((a, b) => a + b, 0);
	const days = calendar.counts.filter((c) => c > 0).length;

	return (
		<StatsSection
			title={t.title}
			subtitle={
				year != null
					? t.subtitleYear(titles, days, year)
					: t.subtitleRecent(titles, days)
			}>
			<CalendarHeatmap
				start={calendar.start}
				counts={calendar.counts}
				locale={intlLocaleOf(locale)}
				fewerLabel={dict.stats.worldMap.fewer}
				moreLabel={dict.stats.worldMap.more}
			/>
		</StatsSection>
	);
}

// Whole-number y range hugging the data, ticked every 1 (or 2 when wide).
function ratingAxis(bins: TimeBin[]) {
	const values = bins.flatMap((b) => (b.value != null ? [b.value] : []));
	if (values.length === 0) return { domain: [0, 10] as [number, number] };
	let lo = Math.max(0, Math.floor(Math.min(...values) - 0.25));
	let hi = Math.min(10, Math.ceil(Math.max(...values) + 0.25));
	const step = hi - lo > 4 ? 2 : 1;
	// Stretch to a whole number of steps so the top edge gets a label too.
	hi = lo + Math.ceil((hi - lo) / step) * step;
	if (hi > 10) {
		lo = Math.max(0, lo - (hi - 10));
		hi = 10;
	}
	const yTicks: number[] = [];
	for (let t = lo; t <= hi; t += step) yTicks.push(t);
	return { domain: [lo, hi] as [number, number], yTicks };
}

// The other "over time" charts on the stats page.
export function TimeSections({ timeline }: Props) {
	const dict = useDictionary();
	const t = dict.stats.timeline;

	const genreSeries = timeline.genreShift.series.map((s, i) => ({
		key: s.name ?? "other",
		label: s.name ?? t.genreShift.other,
		color: s.name == null ? OTHER_COLOR : GENRE_COLORS[i]!,
		values: s.shares,
	}));

	return (
		<>
			<StatsSection
				title={t.ratingOverTime.title}
				subtitle={t.ratingOverTime.subtitle}>
				<RatingLineChart
					series={[
						{
							key: "rating",
							label: t.ratingOverTime.title,
							color: RATING_COLOR,
							values: timeline.ratingByQuarter.map((b) => b.value),
						},
					]}
					ticks={timeline.ratingByQuarter.map((b) =>
						b.key % 4 === 0 ? String(b.key / 4) : "",
					)}
					{...ratingAxis(timeline.ratingByQuarter)}
					emptyText={t.notEnoughData}
				/>
			</StatsSection>

			<StatsSection title={t.genreShift.title} subtitle={t.genreShift.subtitle}>
				<StackedAreaChart
					series={genreSeries}
					ticks={timeline.genreShift.years.map(String)}
					formatPercent={dict.stats.vsPublic.scatter.percent}
					emptyText={t.notEnoughData}
				/>
			</StatsSection>

			<StatsSection title={t.age.title} subtitle={t.age.subtitle}>
				<TimeScatter
					points={timeline.age.map((a) => ({ x: a.watched, y: a.released }))}
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
