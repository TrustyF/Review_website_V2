import {
	runs,
	smoothPath,
} from "@/components/stats/rating-line-chart/rating-line-chart";
import styles from "./rating-scatter.module.sass";

type Props = {
	points: { x: number; y: number }[];
	// Shared x/y range; min defaults to just under the data.
	max: number;
	min?: number;
	// Column width for the average line, in axis units.
	bin: number;
	tickStep?: number;
	// Max display offset per axis, in axis units, to spread out stacked dots.
	jitter?: number;
	aboveColor: string;
	belowColor: string;
	xLabel: string;
	yLabel: string;
	aboveLabel: string;
	belowLabel: string;
	trendLabel: string;
	diagonalLabel: string;
};

// Min titles in a column before it gets a point on the average line: a fixed
// floor, or a share of all dots when there are many.
const MIN_TREND_SAMPLE = 8;
const MIN_TREND_SHARE = 0.02;
// Columns pooled on each side when averaging a point on the line.
const TREND_WINDOW = 1;

// Lower bound skips the sparse bottom 3% so outliers don't zoom the plot out.
function lowerBound(values: number[], max: number) {
	const sorted = values.slice().sort((a, b) => a - b);
	const p = sorted[Math.floor(sorted.length * 0.03)] ?? 0;
	return Math.min(Math.max(Math.floor(p), 0), max - 3);
}

// Stable pseudo-random offset in [-1, 1] per dot and axis, so dots don't move
// between renders or between server and client.
export function noise(i: number, axis: number) {
	let h = Math.imul(i * 2 + axis + 1, 2654435761);
	h ^= h >>> 15;
	h = Math.imul(h, 2246822519);
	h ^= h >>> 13;
	return ((h >>> 0) / 4294967295) * 2 - 1;
}

// Same-range x/y dot plot: dots above the dashed y = x line are colored one
// way and below it the other; the solid line is the average y per column.
export function RatingScatter({
	points,
	max,
	min: fixedMin,
	bin,
	tickStep,
	jitter = 0,
	aboveColor,
	belowColor,
	xLabel,
	yLabel,
	aboveLabel,
	belowLabel,
	trendLabel,
	diagonalLabel,
}: Props) {
	const min =
		fixedMin ??
		lowerBound(
			points.flatMap((p) => [p.x, p.y]),
			max,
		);
	const clamp = (v: number) => Math.min(Math.max(v, min), max);
	const percent = (v: number) => ((clamp(v) - min) / (max - min)) * 100;

	const n = Math.round((max - min) / bin);
	const columns: number[][] = Array.from({ length: n }, () => []);
	for (const { x, y } of points) {
		const i = Math.min(Math.max(Math.floor((x - min) / bin), 0), n - 1);
		columns[i]!.push(y);
	}
	const minSample = Math.max(
		MIN_TREND_SAMPLE,
		Math.ceil(points.length * MIN_TREND_SHARE),
	);
	// Pooled mean over the column and its neighbours, shown only where the
	// column itself is well sampled.
	const trend = columns.map((ys, i) => {
		if (ys.length < minSample) return null;
		const window = columns
			.slice(Math.max(i - TREND_WINDOW, 0), i + TREND_WINDOW + 1)
			.flat();
		return window.reduce((a, b) => a + b, 0) / window.length;
	});
	const step = tickStep ?? (max - min > 6 ? 2 : 1);
	const ticks: number[] = [];
	for (let t = min; t <= max; t += step) ticks.push(t);

	return (
		<div className={styles.wrapper}>
			<ul className={styles.legend}>
				<li className={styles.legend_item}>
					<span
						className={styles.swatch_dot}
						style={{ background: aboveColor }}
					/>
					{aboveLabel}
				</li>
				<li className={styles.legend_item}>
					<span
						className={styles.swatch_dot}
						style={{ background: belowColor }}
					/>
					{belowLabel}
				</li>
				<li className={styles.legend_item}>
					<span className={styles.swatch_trend} />
					{trendLabel}
				</li>
				<li className={styles.legend_item}>
					<span className={styles.swatch_diagonal} />
					{diagonalLabel}
				</li>
			</ul>
			<span className={styles.y_label}>{yLabel}</span>
			<div className={styles.frame}>
				<div className={styles.plot}>
					<svg
						className={styles.svg}
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						aria-hidden>
						{ticks.map((t) => (
							<line
								key={t}
								x1={0}
								x2={100}
								y1={100 - percent(t)}
								y2={100 - percent(t)}
								className={styles.gridline}
								vectorEffect="non-scaling-stroke"
							/>
						))}
						<line
							x1={0}
							y1={100}
							x2={100}
							y2={0}
							className={styles.diagonal}
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
					{points.map((p, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: points have no identity
							key={i}
							className={styles.dot}
							style={{
								left: `${percent(p.x + noise(i, 0) * jitter)}%`,
								top: `${100 - percent(p.y + noise(i, 1) * jitter)}%`,
								background: p.y > p.x ? aboveColor : belowColor,
							}}
						/>
					))}
					{/* Separate layer so the average line draws over the dots. */}
					<svg
						className={styles.svg}
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						aria-hidden>
						{runs(trend).map((run) => (
							<path
								key={run[0]![0]}
								d={smoothPath(
									run.map(([i, v]) => [
										((i + 0.5) / n) * 100,
										100 - percent(v),
									]),
								)}
								className={styles.trend}
								vectorEffect="non-scaling-stroke"
							/>
						))}
					</svg>
					<div className={styles.y_axis} aria-hidden>
						{ticks.map((t) => (
							<span
								key={t}
								className={styles.y_tick}
								style={{ top: `${100 - percent(t)}%` }}>
								{t}
							</span>
						))}
					</div>
				</div>
				<div className={styles.x_axis} aria-hidden>
					{ticks.map((t) => (
						<span
							key={t}
							className={styles.x_tick}
							style={{ left: `${percent(t)}%` }}>
							{t}
						</span>
					))}
				</div>
				<span className={styles.x_label}>{xLabel}</span>
			</div>
		</div>
	);
}
