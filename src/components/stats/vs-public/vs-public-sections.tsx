"use client";
import { useState } from "react";
import { OptionToggle } from "@/components/stats/mode-toggle/mode-toggle";
import { RatingLineChart } from "@/components/stats/rating-line-chart/rating-line-chart";
import { RatingScatter } from "@/components/stats/rating-scatter/rating-scatter";
import { StatsSection } from "@/components/stats/stats-section/stats-section";
import {
	type ComparisonBin,
	MEDIA_TYPE_LABEL_KEY,
	RUNTIME_BAND_MINUTES,
	RUNTIME_MAX,
	RUNTIME_MIN,
	type StatsData,
} from "@/components/stats/stats-types";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./vs-public-sections.module.sass";

const MY_COLOR = "var(--chart-1)";
const PUBLIC_COLOR = "var(--chart-red)";
// Gaps within this much count as "about the same", per scale.
const RAW_AGREEMENT_MARGIN = 0.5;
const RELATIVE_AGREEMENT_MARGIN = 10;

type Scale = "relative" | "raw";

type Props = {
	vsPublic: StatsData["vsPublic"];
};

// Percentile y range hugging the data, in steps of 10 (or 20 when wide).
function percentileAxis(bins: ComparisonBin[]) {
	const values = bins.flatMap((b) =>
		[b.myAvg, b.publicAvg].filter((v): v is number => v != null),
	);
	if (values.length === 0) return { domain: [0, 100] as [number, number] };
	const lo = Math.max(0, Math.floor((Math.min(...values) - 3) / 10) * 10);
	const hi = Math.min(100, Math.ceil((Math.max(...values) + 3) / 10) * 10);
	const step = hi - lo > 50 ? 20 : 10;
	const yTicks: number[] = [];
	for (let t = lo; t <= hi; t += step) yTicks.push(t);
	return { domain: [lo, hi] as [number, number], yTicks };
}

// Ranks with ties sharing their average rank.
function ranks(values: number[]): number[] {
	const order = values
		.map((v, i) => [v, i] as const)
		.sort((a, b) => a[0] - b[0]);
	const result = new Array<number>(values.length);
	for (let start = 0; start < order.length; ) {
		let end = start;
		while (end < order.length && order[end]![0] === order[start]![0]) end++;
		for (let k = start; k < end; k++)
			result[order[k]![1]] = (start + end - 1) / 2;
		start = end;
	}
	return result;
}

// Spearman's rank correlation: Pearson on the ranks, −1 to 1.
function spearman(xs: number[], ys: number[]): number | null {
	if (xs.length < 3) return null;
	const rx = ranks(xs);
	const ry = ranks(ys);
	const mean = (rx.length - 1) / 2;
	let cov = 0;
	let vx = 0;
	let vy = 0;
	for (let i = 0; i < rx.length; i++) {
		const dx = rx[i]! - mean;
		const dy = ry[i]! - mean;
		cov += dx * dy;
		vx += dx * dx;
		vy += dy * dy;
	}
	return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : null;
}

const formatSigned = (v: number, digits: number) =>
	`${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;

// Every chart comparing my ratings with the public's.
export function VsPublicSections({ vsPublic }: Props) {
	const dict = useDictionary();
	const t = dict.stats.vsPublic;
	const s = t.scatter;
	const [scale, setScale] = useState<Scale>("relative");
	const relative = scale === "relative";
	const items = t.typePlurals[MEDIA_TYPE_LABEL_KEY[vsPublic.type]];
	const notEnoughData = t.notEnoughData(items);
	// Runtime is movie-only data; popularity exists for movies and TV.
	const showRuntime = vsPublic.type === "MOVIE";
	const showPopularity =
		vsPublic.type === "MOVIE" || vsPublic.type === "TVSHOW";

	const averageChart = (
		bins: ComparisonBin[],
		tick: (key: number) => string,
	) => (
		<RatingLineChart
			series={[
				{
					key: "my",
					label: t.mySeries,
					color: MY_COLOR,
					values: bins.map((b) => b.myAvg),
				},
				{
					key: "public",
					label: t.publicSeries,
					color: PUBLIC_COLOR,
					values: bins.map((b) => b.publicAvg),
				},
			]}
			ticks={bins.map((b) => tick(b.key))}
			{...percentileAxis(bins)}
			emptyText={notEnoughData}
		/>
	);

	const points = vsPublic.points.map((p) =>
		relative ? { x: p.publicPct, y: p.myPct } : { x: p.public, y: p.my },
	);
	const margin = relative ? RELATIVE_AGREEMENT_MARGIN : RAW_AGREEMENT_MARGIN;
	const diffs = points.map((p) => p.y - p.x);
	const share = (match: (d: number) => boolean) =>
		s.percent(Math.round((diffs.filter(match).length / diffs.length) * 100));
	const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
	// Percentiles already put each source on one scale, so rank those.
	const agreement = spearman(
		vsPublic.points.map((p) => p.publicPct),
		vsPublic.points.map((p) => p.myPct),
	);
	const summary = [
		{ label: s.higher, value: share((d) => d > margin) },
		{
			label: relative ? s.sameRelative : s.same,
			value: share((d) => Math.abs(d) <= margin),
		},
		{ label: s.lower, value: share((d) => d < -margin) },
		{
			label: relative ? s.avgDiffRelative : s.avgDiff,
			value: formatSigned(avgDiff, relative ? 0 : 1),
		},
		...(agreement != null
			? [{ label: s.agreement, value: agreement.toFixed(2) }]
			: []),
	];

	// The end bands also hold everything folded in from outside the range.
	const runtimeTick = (key: number) =>
		key === RUNTIME_MIN
			? t.byRuntime.tickUnder(RUNTIME_MIN + RUNTIME_BAND_MINUTES)
			: key === RUNTIME_MAX
				? t.byRuntime.tickOver(RUNTIME_MAX)
				: String(key);

	return (
		<>
			<StatsSection
				title={s.title}
				subtitle={relative ? s.subtitleRelative(items) : s.subtitleRaw(items)}
				actions={
					<OptionToggle
						value={scale}
						onChange={setScale}
						options={[
							{ value: "relative", label: s.relative },
							{ value: "raw", label: s.raw },
						]}
					/>
				}>
				{diffs.length > 0 ? (
					<div className={styles.scatter_layout}>
						<RatingScatter
							points={points}
							{...(relative
								? { min: 0, max: 100, bin: 10, tickStep: 20, jitter: 2 }
								: { max: 10, bin: 0.5, jitter: 0.2 })}
							aboveColor={MY_COLOR}
							belowColor={PUBLIC_COLOR}
							xLabel={relative ? s.xLabelRelative : s.xLabel}
							yLabel={relative ? s.yLabelRelative : s.yLabel}
							aboveLabel={s.higherLegend}
							belowLabel={s.lowerLegend}
							trendLabel={s.trend}
							diagonalLabel={relative ? s.diagonalRelative : s.diagonal}
						/>
						<dl className={styles.summary}>
							{summary.map((item) => (
								<div key={item.label} className={styles.summary_item}>
									<dt className={styles.summary_label}>{item.label}</dt>
									<dd className={styles.summary_value}>{item.value}</dd>
								</div>
							))}
						</dl>
					</div>
				) : (
					<p className={styles.empty}>{notEnoughData}</p>
				)}
			</StatsSection>

			<div className={styles.row}>
				<StatsSection
					title={t.byDecade.title}
					subtitle={t.byDecade.subtitle(items)}>
					{averageChart(vsPublic.byDecade, (k) =>
						dict.stats.mediaByDecade.tick(k),
					)}
				</StatsSection>
				<StatsSection
					title={t.byReviewYear.title}
					subtitle={t.byReviewYear.subtitle(items)}>
					{averageChart(vsPublic.byReviewYear, String)}
				</StatsSection>
			</div>

			{(showRuntime || showPopularity) && (
				<div className={styles.row}>
					{showRuntime && (
						<StatsSection
							title={t.byRuntime.title}
							subtitle={t.byRuntime.subtitle}>
							{averageChart(vsPublic.byRuntime, runtimeTick)}
						</StatsSection>
					)}
					{showPopularity && (
						<StatsSection
							title={t.byPopularity.title}
							subtitle={t.byPopularity.subtitle(items)}>
							{averageChart(vsPublic.byPopularity, (k) =>
								t.byPopularity.tick(k * 20, (k + 1) * 20),
							)}
						</StatsSection>
					)}
				</div>
			)}
		</>
	);
}
