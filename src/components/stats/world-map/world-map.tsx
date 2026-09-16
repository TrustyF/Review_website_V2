"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
	WORLD_MAP_COUNTRIES,
	WORLD_MAP_VIEWBOX,
} from "@/components/stats/world-map/world-map-paths.generated";
import { Clickable } from "@/components/ui/clickable";
import { countryFlagEmoji } from "@/lib/country-flag";
import { useDictionary } from "@/lib/i18n/i18n-context";
import type { CountryStat } from "@/components/stats/stats-types";
import styles from "./world-map.module.sass";

type Props = {
	data: CountryStat[];
};

type Mode = "count" | "rating";

// A single- or double-digit-sample country's "average" is mostly noise —
// excluded from the rating map/legend scale, though its number still shows on hover.
const MIN_SAMPLE_FOR_RATING = 1;

type Hovered = CountryStat & { x: number; y: number };

// Non-linear (sqrt) intensity so one dominant country (e.g. a huge US count)
// doesn't wash every other represented country down to near-invisible.
function countIntensity(count: number, max: number): number {
	if (count <= 0 || max <= 0) return 0;
	return 15 + 80 * Math.sqrt(count / max);
}

// Linear, and anchored to the observed min/max (not 0) — ratings cluster in a
// narrow band, so a 0-based scale would barely separate any two countries.
function ratingIntensity(rating: number, min: number, max: number): number {
	if (max <= min) return 55;
	return 15 + 80 * ((rating - min) / (max - min));
}

export function WorldMap({ data }: Props) {
	const dict = useDictionary();
	const router = useRouter();
	const [mode, setMode] = useState<Mode>("count");
	const [hovered, setHovered] = useState<Hovered | null>(null);

	const statByCode = useMemo(
		() => new Map(data.map((d) => [d.code, d])),
		[data],
	);
	const maxCount = useMemo(
		() => Math.max(...data.map((d) => d.count), 1),
		[data],
	);
	const ratingBounds = useMemo(() => {
		const rated = data.filter(
			(d) => d.avgRating != null && d.count >= MIN_SAMPLE_FOR_RATING,
		);
		const ratings = rated.map((d) => d.avgRating!);
		return {
			min: ratings.length ? Math.min(...ratings) : 0,
			max: ratings.length ? Math.max(...ratings) : 10,
		};
	}, [data]);

	return (
		<div className={styles.wrapper}>
			<div className={styles.toggle}>
				<Clickable
					className={styles.toggle_option}
					aria-pressed={mode === "count"}
					data-active={mode === "count"}
					onClick={() => setMode("count")}>
					{dict.stats.modeToggle.titles}
				</Clickable>
				<Clickable
					className={styles.toggle_option}
					aria-pressed={mode === "rating"}
					data-active={mode === "rating"}
					onClick={() => setMode("rating")}>
					{dict.stats.modeToggle.rating}
				</Clickable>
			</div>

			<svg
				viewBox={WORLD_MAP_VIEWBOX}
				className={styles.svg}
				role="img"
				aria-label={dict.stats.worldMap.subtitle}>
				{WORLD_MAP_COUNTRIES.map((country) => {
					const stat = statByCode.get(country.code);
					const intensity =
						mode === "count"
							? countIntensity(stat?.count ?? 0, maxCount)
							: stat &&
									stat.avgRating != null &&
									stat.count >= MIN_SAMPLE_FOR_RATING
								? ratingIntensity(
										stat.avgRating,
										ratingBounds.min,
										ratingBounds.max,
									)
								: 0;
					const hasMedia = (stat?.count ?? 0) > 0;
					return (
						<path
							key={country.code}
							d={country.d}
							className={styles.country}
							data-clickable={hasMedia}
							style={
								intensity > 0
									? {
											fill: `color-mix(in srgb, var(--brand) ${intensity}%, var(--surface))`,
										}
									: undefined
							}
							onMouseEnter={(e) =>
								setHovered({
									code: country.code,
									name: country.name,
									count: stat?.count ?? 0,
									avgRating: stat?.avgRating ?? null,
									x: e.clientX,
									y: e.clientY,
								})
							}
							onMouseMove={(e) =>
								setHovered((prev) =>
									prev && prev.code === country.code
										? { ...prev, x: e.clientX, y: e.clientY }
										: prev,
								)
							}
							onMouseLeave={() => setHovered(null)}
							onClick={() => {
								if (hasMedia) router.push(`/country/${country.code}`);
							}}
						/>
					);
				})}
			</svg>

			<div className={styles.legend}>
				<span className={styles.legend_label}>
					{mode === "count"
						? dict.stats.worldMap.fewer
						: dict.stats.worldMap.lower}
				</span>
				<span className={styles.legend_ramp} />
				<span className={styles.legend_label}>
					{mode === "count"
						? dict.stats.worldMap.more
						: dict.stats.worldMap.higher}
				</span>
			</div>

			{hovered &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						className={styles.tooltip}
						style={{ left: hovered.x, top: hovered.y }}>
						<span className={styles.tooltip_flag}>
							{countryFlagEmoji(hovered.code)}
						</span>
						<span>{hovered.name}</span>
						<span className={styles.tooltip_count}>
							{mode === "count"
								? hovered.count > 0
									? dict.stats.titleCount(hovered.count)
									: "—"
								: hovered.avgRating != null
									? dict.stats.worldMap.tooltipRating(
											hovered.avgRating,
											hovered.count,
										)
									: hovered.count > 0
										? dict.stats.worldMap.noRating
										: "—"}
						</span>
					</div>,
					document.body,
				)}
		</div>
	);
}
