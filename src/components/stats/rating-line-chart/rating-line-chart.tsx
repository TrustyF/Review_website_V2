import styles from "./rating-line-chart.module.sass";

type Series = {
	key: string;
	label: string;
	color: string;
	// One value per tick, all series on one shared scale; null leaves a gap.
	values: (number | null)[];
};

type Props = {
	series: Series[];
	ticks: string[];
	// Fixed [min, max] y range; defaults to 0 up to the largest value.
	domain?: [number, number];
	// Labelled gridlines; omitted renders no y-axis at all.
	yTicks?: number[];
	// Shown over an empty plot when no series has two points to connect.
	emptyText?: string;
};

// Whole-number 0–10 y range hugging the values, ticked every 1 (or 2 when wide).
export function ratingAxis(values: number[]) {
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

// Columns center each point on its tick, matching VerticalBarChart's layout.
const xPercent = (i: number, n: number) => ((i + 0.5) / n) * 100;

// Monotone cubic (Fritsch–Carlson) path: smooth, but never overshoots the points.
export function smoothPath(points: [number, number][]): string {
	const n = points.length;
	if (n === 0) return "";
	if (n === 1) return `M${points[0]![0]},${points[0]![1]}`;
	const dx = points.slice(1).map((p, i) => p[0] - points[i]![0]);
	const slopes = points.slice(1).map((p, i) => (p[1] - points[i]![1]) / dx[i]!);
	const tangents = points.map((_, i) => {
		if (i === 0) return slopes[0]!;
		if (i === n - 1) return slopes[n - 2]!;
		const a = slopes[i - 1]!;
		const b = slopes[i]!;
		return a * b <= 0
			? 0
			: (3 * (dx[i - 1]! + dx[i]!)) /
					((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b);
	});
	let d = `M${points[0]![0]},${points[0]![1]}`;
	for (let i = 0; i < n - 1; i++) {
		const [x0, y0] = points[i]!;
		const [x1, y1] = points[i + 1]!;
		const h = dx[i]! / 3;
		d += ` C${x0 + h},${y0 + h * tangents[i]!} ${x1 - h},${y1 - h * tangents[i + 1]!} ${x1},${y1}`;
	}
	return d;
}

// Splits a series at its nulls so each run draws as its own curve.
export function runs(values: (number | null)[]): [number, number][][] {
	const result: [number, number][][] = [];
	let current: [number, number][] = [];
	values.forEach((v, i) => {
		if (v == null) {
			if (current.length > 0) result.push(current);
			current = [];
		} else {
			current.push([i, v]);
		}
	});
	if (current.length > 0) result.push(current);
	return result;
}

// Multi-series smoothed line chart over fixed ticks.
export function RatingLineChart({
	series,
	ticks,
	domain,
	yTicks,
	emptyText,
}: Props) {
	const n = ticks.length;
	const withData = series.filter((s) =>
		s.values.some((v) => v != null && v > 0),
	);
	const drawable = withData.some(
		(s) => s.values.filter((v) => v != null).length >= 2,
	);
	// Empty still renders the full frame, so the section keeps its height.
	const plotted = drawable ? withData : [];
	const values = plotted.flatMap((s) =>
		s.values.filter((v): v is number => v != null),
	);
	const [min, max] = domain ?? [0, Math.max(...values, 1)];
	const yPercent = (v: number) => 100 - ((v - min) / (max - min)) * 100;

	return (
		<div className={styles.wrapper}>
			{series.length > 1 && (
				<ul className={styles.legend}>
					{series.map((s) => (
						<li key={s.key} className={styles.legend_item}>
							<span
								className={styles.legend_swatch}
								style={{ background: s.color }}
							/>
							{s.label}
						</li>
					))}
				</ul>
			)}
			<div className={styles.body}>
				{yTicks && (
					<div className={styles.y_axis} aria-hidden>
						{yTicks.map((t) => (
							<span
								key={t}
								className={styles.y_tick}
								style={{ top: `${yPercent(t)}%` }}>
								{t}
							</span>
						))}
					</div>
				)}
				<div className={styles.main}>
					<div className={styles.plot}>
						<svg
							className={styles.lines}
							viewBox="0 0 100 100"
							preserveAspectRatio="none"
							aria-hidden>
							{yTicks?.map((t) => (
								<line
									key={t}
									x1={0}
									x2={100}
									y1={yPercent(t)}
									y2={yPercent(t)}
									className={styles.gridline}
									vectorEffect="non-scaling-stroke"
								/>
							))}
							{/* Reversed so the first series paints on top. */}
							{plotted
								.slice()
								.reverse()
								.flatMap((s) =>
									runs(s.values).map((run) => (
										<path
											key={`${s.key}-${run[0]![0]}`}
											d={smoothPath(
												run.map(([i, v]) => [xPercent(i, n), yPercent(v)]),
											)}
											fill="none"
											stroke={s.color}
											strokeWidth={2}
											strokeLinejoin="round"
											strokeLinecap="round"
											vectorEffect="non-scaling-stroke"
										/>
									)),
								)}
						</svg>
						{plotted
							.slice()
							.reverse()
							.map((s) =>
								s.values.map((v, i) =>
									v == null ? null : (
										<span
											key={`${s.key}-${i}`}
											className={styles.dot}
											style={{
												left: `${xPercent(i, n)}%`,
												top: `${yPercent(v)}%`,
												background: s.color,
											}}
										/>
									),
								),
							)}
						{!drawable && <p className={styles.empty}>{emptyText}</p>}
					</div>
					<div className={styles.ticks}>
						{ticks.map((tick, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: ticks are positional and may repeat or be blank
							<span
								key={i}
								className={styles.tick}
								// A label between blank ticks may spill into them instead of clipping.
								data-spill={!ticks[i - 1] && !ticks[i + 1]}>
								{tick}
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
