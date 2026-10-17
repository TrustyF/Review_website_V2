import { smoothPath } from "@/components/stats/rating-line-chart/rating-line-chart";
import styles from "./stacked-area-chart.module.sass";

type Series = {
	key: string;
	label: string;
	color: string;
	// Share (0–1) per tick; every tick's series sum to 1.
	values: number[];
};

type Props = {
	series: Series[];
	ticks: string[];
	formatPercent: (value: number) => string;
	emptyText: string;
};

const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

// 100%-stacked areas, first series at the bottom; legend lists them top-down.
export function StackedAreaChart({
	series,
	ticks,
	formatPercent,
	emptyText,
}: Props) {
	const n = ticks.length;
	// Empty still renders the full frame, so the section keeps its height.
	const empty = n < 2;
	const x = (i: number) => (i / (n - 1)) * 100;
	const y = (share: number) => 100 - share * 100;
	const cumulative = new Array<number>(n).fill(0);
	const layers = (empty ? [] : series).map((s) => {
		const lower = cumulative.map((v, i) => [x(i), y(v)] as [number, number]);
		s.values.forEach((v, i) => {
			cumulative[i]! += v;
		});
		const upper = cumulative.map((v, i) => [x(i), y(v)] as [number, number]);
		// Same monotone curve for a layer's top and the next layer's bottom, so they meet exactly.
		const back = smoothPath(lower.reverse()).replace(/^M/, "L");
		return { ...s, d: `${smoothPath(upper)} ${back} Z` };
	});

	return (
		<div className={styles.wrapper}>
			<ul className={styles.legend}>
				{series
					.slice()
					.reverse()
					.map((s) => (
						<li key={s.key} className={styles.legend_item}>
							<span
								className={styles.legend_swatch}
								style={{ background: s.color }}
							/>
							{s.label}
						</li>
					))}
			</ul>
			<div className={styles.body}>
				<div className={styles.y_axis} aria-hidden>
					{Y_TICKS.map((t) => (
						<span key={t} className={styles.y_tick} style={{ top: `${y(t)}%` }}>
							{formatPercent(Math.round(t * 100))}
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
							{layers.map((l) => (
								<path
									key={l.key}
									d={l.d}
									fill={l.color}
									className={styles.layer}
									vectorEffect="non-scaling-stroke"
								/>
							))}
						</svg>
						{empty && <p className={styles.empty}>{emptyText}</p>}
					</div>
					<div className={styles.x_axis} aria-hidden>
						{(empty ? [] : ticks).map((tick, i) =>
							tick ? (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: ticks are positional and may be blank
									key={i}
									className={styles.x_tick}
									style={{ left: `${x(i)}%` }}>
									{tick}
								</span>
							) : null,
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
