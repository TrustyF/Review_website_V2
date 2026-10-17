import {
	type ScatterDot,
	ScatterDots,
} from "@/components/stats/scatter-dots/scatter-dots";
import styles from "./rating-scatter.module.sass";

type Props = {
	points: (ScatterDot & { x: number; y: number })[];
	// Shared x/y range; min defaults to just under the data.
	max: number;
	min?: number;
	tickStep?: number;
	// Max display offset per axis, in axis units, to spread out stacked dots.
	jitter?: number;
	aboveColor: string;
	belowColor: string;
	xLabel: string;
	yLabel: string;
	aboveLabel: string;
	belowLabel: string;
	diagonalLabel: string;
	// Shown over the empty plot when there are no points.
	emptyText?: string;
};

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
// way and below it the other.
export function RatingScatter({
	points,
	max,
	min: fixedMin,
	tickStep,
	jitter = 0,
	aboveColor,
	belowColor,
	xLabel,
	yLabel,
	aboveLabel,
	belowLabel,
	diagonalLabel,
	emptyText,
}: Props) {
	const min =
		fixedMin ??
		lowerBound(
			points.flatMap((p) => [p.x, p.y]),
			max,
		);
	const clamp = (v: number) => Math.min(Math.max(v, min), max);
	const percent = (v: number) => ((clamp(v) - min) / (max - min)) * 100;

	const step = tickStep ?? (max - min > 6 ? 2 : 1);
	const ticks: number[] = [];
	for (let t = min; t <= max; t += step) ticks.push(t);
	const position = (i: number) => {
		const p = points[i]!;
		return {
			left: `${percent(p.x + noise(i, 0) * jitter)}%`,
			top: `${100 - percent(p.y + noise(i, 1) * jitter)}%`,
		};
	};

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
					<ScatterDots
						points={points}
						position={position}
						color={(i) =>
							points[i]!.y > points[i]!.x ? aboveColor : belowColor
						}
						dotClassName={styles.dot}
					/>
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
					{points.length === 0 && <p className={styles.empty}>{emptyText}</p>}
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
