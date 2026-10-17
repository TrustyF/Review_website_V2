import { noise } from "@/components/stats/rating-scatter/rating-scatter";
import {
	type ScatterDot,
	ScatterDots,
} from "@/components/stats/scatter-dots/scatter-dots";
import styles from "./time-scatter.module.sass";

type Props = {
	// Fractional years on both axes.
	points: (ScatterDot & { x: number; y: number })[];
	dotColor: string;
	dotLabel: string;
	xLabel: string;
	yLabel: string;
	sameYearLabel: string;
	emptyText: string;
};

// Max display offset in years, to spread out dots logged or released together
// (bulk-imported days, same-year releases).
const X_JITTER = 0.08;
const Y_JITTER = 0.4;

// Lower y bound skips the oldest 3% so a few classics don't squash the rest.
function yLowerBound(values: number[]) {
	const sorted = values.slice().sort((a, b) => a - b);
	return Math.floor((sorted[Math.floor(sorted.length * 0.03)] ?? 0) / 10) * 10;
}

function yearTicks(min: number, max: number, step: number) {
	const ticks: number[] = [];
	for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(t);
	return ticks;
}

// Dots of year-vs-year data with a dashed y = x line.
export function TimeScatter({
	points,
	dotColor,
	dotLabel,
	xLabel,
	yLabel,
	sameYearLabel,
	emptyText,
}: Props) {
	// Empty still renders the full frame, so the section keeps its height.
	const empty = points.length === 0;
	const xs = empty ? [0] : points.map((p) => p.x);
	const xMin = Math.floor(Math.min(...xs));
	// At least one year (and one decade) wide, so positions never divide by 0.
	const xMax = Math.max(Math.ceil(Math.max(...xs)), xMin + 1);
	const yMin = yLowerBound(points.map((p) => p.y));
	const yMax = Math.max(
		Math.ceil(Math.max(...points.map((p) => p.y), xMax) / 10) * 10,
		yMin + 10,
	);
	// The y = x line, kept to the part inside both ranges so clamping can't bend it.
	const sameFrom = Math.max(xMin, yMin);
	const sameTo = Math.min(xMax, yMax);
	const px = (v: number) => ((v - xMin) / (xMax - xMin)) * 100;
	const py = (v: number) =>
		100 - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * 100;
	const xTicks = empty ? [] : yearTicks(xMin, xMax, xMax - xMin > 8 ? 2 : 1);
	const yTicks = empty ? [] : yearTicks(yMin, yMax, yMax - yMin > 60 ? 20 : 10);

	return (
		<div className={styles.wrapper}>
			<ul className={styles.legend}>
				<li className={styles.legend_item}>
					<span
						className={styles.swatch_dot}
						style={{ background: dotColor }}
					/>
					{dotLabel}
				</li>
				<li className={styles.legend_item}>
					<span className={styles.swatch_diagonal} />
					{sameYearLabel}
				</li>
			</ul>
			<span className={styles.y_label}>{yLabel}</span>
			<div className={styles.body}>
				<div className={styles.y_axis} aria-hidden>
					{yTicks.map((t) => (
						<span
							key={t}
							className={styles.y_tick}
							style={{ top: `${py(t)}%` }}>
							{t}
						</span>
					))}
				</div>
				<div className={styles.main}>
					<div className={styles.plot}>
						<svg
							className={styles.svg}
							viewBox="0 0 100 100"
							preserveAspectRatio="none"
							aria-hidden>
							{yTicks.map((t) => (
								<line
									key={t}
									x1={0}
									x2={100}
									y1={py(t)}
									y2={py(t)}
									className={styles.gridline}
									vectorEffect="non-scaling-stroke"
								/>
							))}
							{!empty && sameFrom < sameTo && (
								<line
									x1={px(sameFrom)}
									y1={py(sameFrom)}
									x2={px(sameTo)}
									y2={py(sameTo)}
									className={styles.diagonal}
									vectorEffect="non-scaling-stroke"
								/>
							)}
						</svg>
						<ScatterDots
							points={points}
							position={(i) => ({
								left: `${px(points[i]!.x + noise(i, 0) * X_JITTER)}%`,
								top: `${py(points[i]!.y + noise(i, 1) * Y_JITTER)}%`,
							})}
							color={() => dotColor}
							dotClassName={styles.dot}
						/>
						{empty && <p className={styles.empty}>{emptyText}</p>}
					</div>
					<div className={styles.x_axis} aria-hidden>
						{xTicks.map((t) => (
							<span
								key={t}
								className={styles.x_tick}
								style={{ left: `${px(t)}%` }}>
								{t}
							</span>
						))}
					</div>
					<span className={styles.x_label}>{xLabel}</span>
				</div>
			</div>
		</div>
	);
}
