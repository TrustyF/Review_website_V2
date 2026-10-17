import styles from "./calendar-heatmap.module.sass";

type Props = {
	// UTC YYYY-MM-DD of counts[0].
	start: string;
	counts: number[];
	locale: string;
	fewerLabel: string;
	moreLabel: string;
};

const LEVEL_COLORS = [
	"var(--surface-border)",
	"color-mix(in srgb, var(--brand) 30%, var(--surface))",
	"color-mix(in srgb, var(--brand) 55%, var(--surface))",
	"color-mix(in srgb, var(--brand) 80%, var(--surface))",
	"var(--brand)",
];
const DAY_MS = 86400000;
// 2024-01-01 was a Monday; used to name weekdays in the viewer's locale.
const A_MONDAY = Date.UTC(2024, 0, 1);

// Quartile thresholds of the non-zero days, so a few huge days don't wash
// out everything else.
function levelOf(count: number, thresholds: number[]) {
	if (count === 0) return 0;
	const above = thresholds.filter((t) => count > t).length;
	return Math.min(above + 1, LEVEL_COLORS.length - 1);
}

// GitHub-style grid: one column per week (Monday first), one square per day.
export function CalendarHeatmap({
	start,
	counts,
	locale,
	fewerLabel,
	moreLabel,
}: Props) {
	const startMs = Date.parse(`${start}T00:00:00Z`);
	const offset = (new Date(startMs).getUTCDay() + 6) % 7;
	const weeks = Math.ceil((offset + counts.length) / 7);

	const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b);
	const quantile = (q: number) =>
		nonZero[Math.floor((nonZero.length - 1) * q)] ?? 0;
	const thresholds = [quantile(0.25), quantile(0.5), quantile(0.75)];

	const monthFormat = new Intl.DateTimeFormat(locale, {
		month: "short",
		timeZone: "UTC",
	});
	const weekdayFormat = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const months = counts.flatMap((_, day) => {
		const date = new Date(startMs + day * DAY_MS);
		return date.getUTCDate() === 1 || day === 0
			? [
					{
						key: day,
						label: monthFormat.format(date),
						column: Math.floor((offset + day) / 7) + 1,
					},
				]
			: [];
	});

	return (
		<div className={styles.wrapper}>
			<div className={styles.scroller}>
				<div
					className={styles.grid_frame}
					style={{ "--weeks": weeks } as React.CSSProperties}>
					<div className={styles.months} aria-hidden>
						{months.map((m) => (
							<span
								key={m.key}
								className={styles.month}
								style={{ gridColumnStart: m.column }}>
								{m.label}
							</span>
						))}
					</div>
					<div className={styles.weekdays} aria-hidden>
						{[0, 2, 4].map((d) => (
							<span
								key={d}
								className={styles.weekday}
								style={{ gridRowStart: d + 1 }}>
								{weekdayFormat.format(new Date(A_MONDAY + d * DAY_MS))}
							</span>
						))}
					</div>
					<div className={styles.days}>
						{counts.map((count, day) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: one fixed slot per day
								key={day}
								className={styles.day}
								style={{
									gridRowStart: ((offset + day) % 7) + 1,
									gridColumnStart: Math.floor((offset + day) / 7) + 1,
									background: LEVEL_COLORS[levelOf(count, thresholds)],
								}}
							/>
						))}
					</div>
				</div>
			</div>
			<div className={styles.legend}>
				{fewerLabel}
				{LEVEL_COLORS.map((color) => (
					<span
						key={color}
						className={styles.legend_square}
						style={{ background: color }}
					/>
				))}
				{moreLabel}
			</div>
		</div>
	);
}
