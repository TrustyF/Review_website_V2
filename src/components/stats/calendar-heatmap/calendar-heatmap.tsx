"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import styles from "./calendar-heatmap.module.sass";

type Props = {
	// UTC YYYY-MM-DD of counts[0].
	start: string;
	counts: number[];
	// Each day's titles, parallel to counts; shown in the hover tooltip.
	titles: string[][];
	countLabel: (count: number) => string;
	moreTitlesLabel: (count: number) => string;
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
const TOOLTIP_MAX_TITLES = 5;
const SQUARE_COLUMN = "minmax(0, 1fr)";
const YEAR_GAP_COLUMN = "4px";

// Viewport coords of the hovered square's top center.
type Hovered = { day: number; x: number; y: number };

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
	titles,
	countLabel,
	moreTitlesLabel,
	locale,
	fewerLabel,
	moreLabel,
}: Props) {
	const [hovered, setHovered] = useState<Hovered | null>(null);
	const startMs = Date.parse(`${start}T00:00:00Z`);
	const offset = (new Date(startMs).getUTCDay() + 6) % 7;
	// New column every Monday, and on Jan 1 after a narrow gap column so the
	// two years don't share a week.
	const columns: string[] = [];
	const columnOfDay: number[] = [];
	for (let day = 0; day < counts.length; day++) {
		const date = new Date(startMs + day * DAY_MS);
		if (day === 0) columns.push(SQUARE_COLUMN);
		else if (date.getUTCMonth() === 0 && date.getUTCDate() === 1)
			columns.push(YEAR_GAP_COLUMN, SQUARE_COLUMN);
		else if ((offset + day) % 7 === 0) columns.push(SQUARE_COLUMN);
		columnOfDay.push(columns.length);
	}
	const columnOf = (day: number) => columnOfDay[day]!;
	const squareColumns = columns.filter((c) => c === SQUARE_COLUMN).length;

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
	const dateFormat = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
	const months = counts.flatMap((_, day) => {
		const date = new Date(startMs + day * DAY_MS);
		return date.getUTCDate() === 1 || day === 0
			? [
					{
						key: day,
						label: monthFormat.format(date),
						column: columnOf(day),
					},
				]
			: [];
	});

	return (
		<div className={styles.wrapper}>
			<div className={styles.scroller}>
				<div
					className={styles.grid_frame}
					style={
						{
							"--columns": columns.join(" "),
							"--squares": squareColumns,
						} as React.CSSProperties
					}>
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
						{[0, 2, 4, 6].map((d) => (
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
									gridColumnStart: columnOf(day),
									background: LEVEL_COLORS[levelOf(count, thresholds)],
								}}
								data-active={hovered?.day === day}
								onMouseEnter={(e) => {
									if (count === 0) return;
									const rect = e.currentTarget.getBoundingClientRect();
									setHovered({
										day,
										x: rect.left + rect.width / 2,
										y: rect.top,
									});
								}}
								onMouseLeave={() => setHovered(null)}
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

			{hovered &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						className={styles.tooltip}
						style={{ left: hovered.x, top: hovered.y }}>
						<span className={styles.tooltip_date}>
							{dateFormat.format(new Date(startMs + hovered.day * DAY_MS))}
						</span>
						<span className={styles.tooltip_count}>
							{countLabel(counts[hovered.day] ?? 0)}
						</span>
						{titles[hovered.day]!.slice(0, TOOLTIP_MAX_TITLES).map(
							(title, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: the same title can be logged twice
								<span key={i} className={styles.tooltip_title}>
									{title}
								</span>
							),
						)}
						{(titles[hovered.day]?.length ?? 0) > TOOLTIP_MAX_TITLES && (
							<span className={styles.tooltip_count}>
								{moreTitlesLabel(
									titles[hovered.day]!.length - TOOLTIP_MAX_TITLES,
								)}
							</span>
						)}
					</div>,
					document.body,
				)}
		</div>
	);
}
