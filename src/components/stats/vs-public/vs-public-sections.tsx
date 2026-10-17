"use client";
import {
	RatingLineChart,
	ratingAxis,
} from "@/components/stats/rating-line-chart/rating-line-chart";
import { useState } from "react";
import { PillToggle } from "@/components/stats/mode-toggle/mode-toggle";
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
import { useDictionary, useLocale } from "@/lib/i18n/i18n-context";
import styles from "./vs-public-sections.module.sass";

const MY_COLOR = "var(--chart-1)";
const PUBLIC_COLOR = "var(--chart-red)";
const SAME_COLOR = "color-mix(in srgb, var(--accent2) 45%, transparent)";
// Gaps within this many points count as "about the same".
const AGREEMENT_MARGIN = 0.5;

type Props = {
	vsPublic: StatsData["vsPublic"];
};

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

type Point = {
	x: number;
	y: number;
	label: string;
	detail: string;
	href: string;
};

const mean = (vs: number[]) => vs.reduce((a, b) => a + b, 0) / vs.length;
const stdDev = (vs: number[]) => {
	const m = mean(vs);
	return Math.sqrt(mean(vs.map((v) => (v - m) ** 2)));
};

// Mean and spread of the public scores (x) and of mine (y); null when the
// public side can't be rescaled.
function fitOf(points: Point[]) {
	if (points.length < 2) return null;
	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);
	const xSd = stdDev(xs);
	if (xSd === 0) return null;
	return { xMean: mean(xs), xSd, yMean: mean(ys), ySd: stdDev(ys) };
}

// Linearly maps public scores onto my ratings' mean and spread.
function rescalePublicToMine(
	points: Point[],
	fit: NonNullable<ReturnType<typeof fitOf>>,
): Point[] {
	const scale = fit.ySd / fit.xSd;
	return points.map((p) => ({
		...p,
		x: fit.yMean + (p.x - fit.xMean) * scale,
	}));
}

// Rough bands for a rank correlation.
function agreementLevel(r: number) {
	if (r >= 0.7) return "veryHigh";
	if (r >= 0.4) return "high";
	if (r >= 0.2) return "some";
	if (r > -0.2) return "little";
	return "opposite";
}

const formatSigned = (v: number) =>
	`${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;

// Every chart comparing my ratings with the public's.
export function VsPublicSections({ vsPublic }: Props) {
	const dict = useDictionary();
	const locale = useLocale();
	const [scale, setScale] = useState<"fit" | "raw">("fit");
	const t = dict.stats.vsPublic;
	const s = t.scatter;
	const items = t.typePlurals[MEDIA_TYPE_LABEL_KEY[vsPublic.type]];
	const notEnoughData = t.notEnoughData(items);
	// Runtime is movie-only data; popularity exists for movies and TV.
	const showRuntime = vsPublic.type === "MOVIE";
	const showPopularity =
		vsPublic.type === "MOVIE" || vsPublic.type === "TVSHOW";

	const averageChart = (
		bins: ComparisonBin[],
		tick: (key: number) => string,
		emptyText = notEnoughData,
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
			{...ratingAxis(
				bins.flatMap((b) =>
					[b.myAvg, b.publicAvg].filter((v): v is number => v != null),
				),
			)}
			emptyText={emptyText}
		/>
	);

	const rawPoints = vsPublic.points.map((p) => ({
		x: p.public,
		y: p.my,
		label: locale === "fr" ? (p.titleFr ?? p.title) : p.title,
		detail: s.tooltip(p.my, p.public),
		href: `/media/${p.mediaId}`,
	}));
	const fit = fitOf(rawPoints);
	const points =
		scale === "fit" && fit ? rescalePublicToMine(rawPoints, fit) : rawPoints;
	const diffs = points.map((p) => p.y - p.x);
	const hasPoints = diffs.length > 0;
	const shareOf = (match: (d: number) => boolean) =>
		hasPoints ? diffs.filter(match).length / diffs.length : 0;
	const avgDiff = mean(rawPoints.map((p) => p.y - p.x));
	// One type means one public source, so raw values rank fine.
	const agreement = spearman(
		points.map((p) => p.x),
		points.map((p) => p.y),
	);
	// Left to right in the bar, same colors as the dots.
	const split = [
		{
			key: "higher",
			label: s.higher,
			share: shareOf((d) => d > AGREEMENT_MARGIN),
			color: MY_COLOR,
		},
		{
			key: "same",
			label: s.same,
			share: shareOf((d) => Math.abs(d) <= AGREEMENT_MARGIN),
			color: SAME_COLOR,
		},
		{
			key: "lower",
			label: s.lower,
			share: shareOf((d) => d < -AGREEMENT_MARGIN),
			color: PUBLIC_COLOR,
		},
	];
	const figures = [
		{
			label: s.avgDiff,
			value: hasPoints ? formatSigned(avgDiff) : "—",
			hint: !hasPoints
				? null
				: Math.abs(avgDiff) < 0.05
					? s.avgDiffSame
					: avgDiff > 0
						? s.avgDiffHigher(avgDiff.toFixed(1))
						: s.avgDiffLower(Math.abs(avgDiff).toFixed(1)),
		},
		{
			label: s.agreement,
			value: agreement != null ? agreement.toFixed(2) : "—",
			hint:
				agreement == null ? null : s.agreementLevels[agreementLevel(agreement)],
		},
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
				subtitle={s.subtitle}
				actions={
					<PillToggle
						value={scale}
						options={[
							{ value: "raw", label: s.scaleRaw },
							{ value: "fit", label: s.scaleFit },
						]}
						onChange={setScale}
					/>
				}>
				<div className={styles.scatter_layout}>
					<RatingScatter
						points={points}
						max={10}
						jitter={0.2}
						aboveColor={MY_COLOR}
						belowColor={PUBLIC_COLOR}
						xLabel={s.xLabel}
						yLabel={s.yLabel}
						aboveLabel={s.higherLegend}
						belowLabel={s.lowerLegend}
						diagonalLabel={s.diagonal}
						emptyText={notEnoughData}
					/>
					<div className={styles.summary}>
						{scale === "fit" && fit && (
							<p className={styles.fit_note}>
								{s.fitNote(
									fit.xMean.toFixed(1),
									fit.xSd.toFixed(1),
									fit.yMean.toFixed(1),
									fit.ySd.toFixed(1),
								)}
							</p>
						)}
						<div className={styles.split}>
							<div className={styles.split_bar} aria-hidden>
								{split.map((part) => (
									<span
										key={part.key}
										style={{
											flexGrow: part.share,
											background: part.color,
										}}
									/>
								))}
							</div>
							<dl className={styles.split_rows}>
								{split.map((part) => (
									<div key={part.key} className={styles.split_row}>
										<dt className={styles.split_label}>
											<span
												className={styles.swatch}
												style={{ background: part.color }}
											/>
											{part.label}
										</dt>
										<dd className={styles.split_value}>
											{hasPoints
												? s.percent(Math.round(part.share * 100))
												: "—"}
										</dd>
									</div>
								))}
							</dl>
						</div>
						<dl className={styles.figures}>
							{figures.map((item) => (
								<div key={item.label} className={styles.figure}>
									<dt className={styles.figure_label}>{item.label}</dt>
									<dd className={styles.figure_value}>{item.value}</dd>
									{item.hint && (
										<dd className={styles.figure_hint}>{item.hint}</dd>
									)}
								</div>
							))}
						</dl>
					</div>
				</div>
			</StatsSection>

			<div className={styles.row}>
				<StatsSection title={t.byDecade.title}>
					{averageChart(vsPublic.byDecade, (k) =>
						dict.stats.mediaByDecade.tick(k),
					)}
				</StatsSection>
				<StatsSection title={t.byReviewYear.title}>
					{averageChart(vsPublic.byReviewYear, String)}
				</StatsSection>
			</div>

			{/* Kept for every type (as an empty state) so the page doesn't jump. */}
			<div className={styles.row}>
				<StatsSection title={t.byRuntime.title} subtitle={t.byRuntime.subtitle}>
					{averageChart(
						showRuntime ? vsPublic.byRuntime : [],
						runtimeTick,
						showRuntime ? notEnoughData : t.byRuntime.moviesOnly,
					)}
				</StatsSection>
				<StatsSection
					title={t.byPopularity.title}
					subtitle={t.byPopularity.subtitle}>
					{averageChart(
						showPopularity ? vsPublic.byPopularity : [],
						(k) => t.byPopularity.tick(k * 20, (k + 1) * 20),
						showPopularity ? notEnoughData : t.byPopularity.moviesAndTvOnly,
					)}
				</StatsSection>
			</div>
		</>
	);
}
