"use client";
import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
	WORLD_MAP_COUNTRIES,
	WORLD_MAP_VIEWBOX,
} from "@/components/stats/world-map/world-map-paths.generated";
import {
	globalRatingMean,
	weightedCountryRating,
} from "@/components/stats/world-map/rating-weighting";
import { countryFlagEmoji } from "@/lib/country-flag";
import { useDictionary } from "@/lib/i18n/i18n-context";
import { Clickable } from "@/components/ui/clickable";
import type { CountryStat } from "@/components/stats/stats-types";
import styles from "./world-map.module.sass";

export type WorldMapMode = "count" | "rating";

type Props = {
	data: CountryStat[];
	mode: WorldMapMode;
};

// Fixed endpoints for each gradient — edit these directly to set what counts
// as "low"/"high" on the color scale, instead of auto-fitting to whatever
// the current data's own min/max happens to be.
const COUNT_SCALE_MIN = 1;
const COUNT_SCALE_MAX = 100;
const RATING_SCALE_MIN = 5;
const RATING_SCALE_MAX = 7;

type Hovered = CountryStat & { x: number; y: number };

type ViewBox = { x: number; y: number; w: number; h: number };

const [viewBoxX, viewBoxY, viewBoxW, viewBoxH] = WORLD_MAP_VIEWBOX.split(" ");
const BASE_X = Number(viewBoxX);
const BASE_Y = Number(viewBoxY);
const BASE_W = Number(viewBoxW);
const BASE_H = Number(viewBoxH);
const BASE_VIEWBOX: ViewBox = { x: BASE_X, y: BASE_Y, w: BASE_W, h: BASE_H };
const MAX_ZOOM = 8;
const MIN_ZOOM = 1;
const WHEEL_ZOOM_FACTOR = 1.15;

// Keeps zoom within [MIN_ZOOM, MAX_ZOOM] and pan inside the base bounds so
// you can never drag/zoom the map off into empty space.
function clampViewBox(vb: ViewBox): ViewBox {
	const w = Math.min(BASE_W / MIN_ZOOM, Math.max(BASE_W / MAX_ZOOM, vb.w));
	const h = w * (BASE_H / BASE_W);
	if (w >= BASE_W) return BASE_VIEWBOX;
	const x = Math.min(BASE_X + BASE_W - w, Math.max(BASE_X, vb.x));
	const y = Math.min(BASE_Y + BASE_H - h, Math.max(BASE_Y, vb.y));
	return { x, y, w, h };
}

// color-mix() with a percentage outside 0-100 renders unpredictably (often
// solid black) rather than clamping itself, so every intensity funnels through here.
function clampIntensity(value: number): number {
	return Math.min(100, Math.max(0, value));
}

// Non-linear (sqrt) intensity so one dominant country (e.g. a huge US count)
// doesn't wash every other represented country down to near-invisible. Ratio
// clamps to [0, 1] first — sqrt of a negative (count below min) is NaN.
function countIntensity(count: number, min: number, max: number): number {
	if (count <= 0 || max <= min) return 0;
	const ratio = Math.min(1, Math.max(0, (count - min) / (max - min)));
	return clampIntensity(15 + 90 * Math.sqrt(ratio));
}

// Linear, anchored to the given (fixed, editable) min/max, not 0 — a rating
// outside that range still clamps in rather than over/undershooting the scale.
function ratingIntensity(rating: number, min: number, max: number): number {
	if (max <= min) return 55;
	return clampIntensity(15 + 90 * ((rating - min) / (max - min)));
}

// --world-map-{mode}-low/-high are this map's own one-off tokens (see
// .wrapper in world-map.module.sass), not the site's shared palette.
function intensityColor(mode: WorldMapMode, pct: number): string {
	return `color-mix(in srgb, var(--world-map-${mode}-high) ${pct}%, var(--world-map-${mode}-low))`;
}

export function WorldMap({ data, mode }: Props) {
	const dict = useDictionary();
	const router = useRouter();
	const [hovered, setHovered] = useState<Hovered | null>(null);
	const [viewBox, setViewBox] = useState<ViewBox>(BASE_VIEWBOX);
	const svgRef = useRef<SVGSVGElement>(null);
	// Drag state lives in a ref, not React state, since pointermove fires far
	// too often to route through re-renders.
	const dragRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		startViewBox: ViewBox;
		moved: boolean;
	} | null>(null);
	const isZoomed = viewBox.w < BASE_VIEWBOX.w;

	// Native listener (not onWheel) so preventDefault actually blocks page
	// scroll — React marks onWheel passive by default.
	useEffect(() => {
		const el = svgRef.current;
		if (!el) return;
		function handleWheel(e: WheelEvent) {
			e.preventDefault();
			const rect = el!.getBoundingClientRect();
			const factor = e.deltaY > 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
			setViewBox((prev) => {
				const mx = prev.x + ((e.clientX - rect.left) / rect.width) * prev.w;
				const my = prev.y + ((e.clientY - rect.top) / rect.height) * prev.h;
				return clampViewBox({
					x: mx - (mx - prev.x) * factor,
					y: my - (my - prev.y) * factor,
					w: prev.w * factor,
					h: prev.h * factor,
				});
			});
		}
		el.addEventListener("wheel", handleWheel, { passive: false });
		return () => el.removeEventListener("wheel", handleWheel);
	}, []);

	// Right button only (button === 2) — left click stays free to navigate.
	function handlePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
		if (e.button !== 2) return;
		e.preventDefault();
		svgRef.current?.setPointerCapture(e.pointerId);
		dragRef.current = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			startViewBox: viewBox,
			moved: false,
		};
	}

	function handlePointerMove(e: ReactPointerEvent<SVGSVGElement>) {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== e.pointerId || !svgRef.current) return;
		const rect = svgRef.current.getBoundingClientRect();
		const dxScreen = e.clientX - drag.startX;
		const dyScreen = e.clientY - drag.startY;
		if (!drag.moved && Math.hypot(dxScreen, dyScreen) > 3) drag.moved = true;
		if (!drag.moved) return;
		const dxSvg = (dxScreen / rect.width) * drag.startViewBox.w;
		const dySvg = (dyScreen / rect.height) * drag.startViewBox.h;
		setViewBox(
			clampViewBox({
				x: drag.startViewBox.x - dxSvg,
				y: drag.startViewBox.y - dySvg,
				w: drag.startViewBox.w,
				h: drag.startViewBox.h,
			}),
		);
	}

	function handlePointerUp(e: ReactPointerEvent<SVGSVGElement>) {
		const drag = dragRef.current;
		if (drag && drag.pointerId === e.pointerId) {
			svgRef.current?.releasePointerCapture(e.pointerId);
		}
		dragRef.current = null;
	}

	const statByCode = useMemo(
		() => new Map(data.map((d) => [d.code, d])),
		[data],
	);
	const ratingMean = useMemo(() => globalRatingMean(data), [data]);
	// Computed once per mode/data change, then read by the <path> pass below.
	// weightedRating replaces stat.avgRating wherever a rating is shown or
	// colored — it's the one place shrinkage is applied.
	const countryIntensities = useMemo(
		() =>
			WORLD_MAP_COUNTRIES.map((country) => {
				const stat = statByCode.get(country.code);
				const weightedRating = stat
					? weightedCountryRating(stat, ratingMean)
					: null;
				const intensity =
					mode === "count"
						? countIntensity(stat?.count ?? 0, COUNT_SCALE_MIN, COUNT_SCALE_MAX)
						: weightedRating != null
							? ratingIntensity(
									weightedRating,
									RATING_SCALE_MIN,
									RATING_SCALE_MAX,
								)
							: 0;
				return { country, stat, intensity, weightedRating };
			}),
		[mode, statByCode, ratingMean],
	);

	return (
		<div className={styles.wrapper}>
			<div className={styles.svg_container}>
				{isZoomed && (
					<Clickable
						className={styles.reset_zoom}
						title={dict.stats.worldMap.resetZoom}
						aria-label={dict.stats.worldMap.resetZoom}
						onClick={() => setViewBox(BASE_VIEWBOX)}>
						{dict.stats.worldMap.resetZoom}
					</Clickable>
				)}
				<svg
					ref={svgRef}
					viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
					className={styles.svg}
					data-zoomed={isZoomed}
					role="img"
					aria-label={dict.stats.worldMap.subtitle}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={handlePointerUp}
					onContextMenu={(e) => e.preventDefault()}>
					{countryIntensities.map(
						({ country, stat, intensity, weightedRating }) => {
							const hasMedia = (stat?.count ?? 0) > 0;
							return (
								<path
									key={country.code}
									d={country.d}
									className={styles.country}
									data-clickable={hasMedia}
									style={
										intensity > 0
											? { fill: intensityColor(mode, intensity) }
											: undefined
									}
									onMouseEnter={(e) =>
										setHovered({
											code: country.code,
											name: country.name,
											count: stat?.count ?? 0,
											avgRating: weightedRating,
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
						},
					)}
				</svg>
			</div>

			<div className={styles.legend}>
				<span className={styles.legend_label}>
					{mode === "count"
						? dict.stats.worldMap.fewer
						: dict.stats.worldMap.lower}
				</span>
				<span className={styles.legend_ramp} data-mode={mode} />
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
