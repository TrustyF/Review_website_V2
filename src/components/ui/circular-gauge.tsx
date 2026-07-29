import { CSSProperties, ReactNode } from "react";
import styles from "./circular-gauge.module.sass";

export type CircularGaugeProps = {
	/** Current value. Magnitudes beyond `max` wrap around and start a new lap. Negative values wrap the other way around. */
	value: number;
	/** Value that represents one full revolution, in either direction. */
	max?: number;
	/** Outer diameter in px. */
	size?: number;
	textScaling?: number;
	strokeWidth?: number;
	trackColor?: string;
	/** Color at `value = 0`. */
	startColor?: string;
	/** Color at `value = max / 2`. */
	midColor?: string;
	/** Color at `value = max` and beyond. */
	endColor?: string;
	/** Color at `value = -max` and beyond. */
	negativeColor?: string;
	/** Peak darkness of the trail at its tail end, 0 (no darkening) to 1 (opaque black). */
	trailOpacity?: number;
	/** Appended to the default label, e.g. "%". Ignored when `children` is passed. */
	unit?: string;
	/** Center label font size in px. Defaults to scaling with `size`; set explicitly to grow the ring without growing the label. */
	fontSize?: number;
	showValue?: boolean;
	className?: string;
	/** Overrides the default centered value label. */
	children?: ReactNode;
};

// Keeps the default label from blowing out the gauge's width on outlier
// values — 1234 reads as "1.2k" instead of overflowing past 3 digits.
function formatCompact(n: number): string {
	const rounded = Math.round(n);
	if (Math.abs(rounded) < 1000) return String(rounded);
	return `${(rounded / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

// #rgb / #rrggbb only — enough for the fixed default palette and simple
// hex overrides; not meant to parse arbitrary CSS color syntax.
function hexToRgb(hex: string): [number, number, number] {
	const raw = hex.replace("#", "");
	const full =
		raw.length === 3
			? raw
					.split("")
					.map((c) => c + c)
					.join("")
			: raw;
	const num = parseInt(full, 16);
	return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerpColor(from: string, to: string, t: number): string {
	const [r1, g1, b1] = hexToRgb(from);
	const [r2, g2, b2] = hexToRgb(to);
	const r = Math.round(r1 + (r2 - r1) * t);
	const g = Math.round(g1 + (g2 - g1) * t);
	const b = Math.round(b1 + (b2 - b1) * t);
	return `rgb(${r}, ${g}, ${b})`;
}

export function CircularGauge({
	value,
	max = 100,
	size = 56,
	textScaling = 0.26,
	strokeWidth = 6,
	trackColor = "rgba(127, 127, 127, 0.25)",
	startColor = "#e02222",
	midColor = "#f2d724",
	endColor = "#22e022",
	negativeColor = "#7a1212",
	trailOpacity = 0.75,
	unit = "",
	fontSize,
	showValue = true,
	className,
	children,
}: CircularGaugeProps) {
	const radius = (size - strokeWidth) / 2;
	const center = size / 2;

	const sign = value < 0 ? -1 : 1;
	const magnitude = Math.abs(value);
	const laps = Math.floor(magnitude / max);
	const progress = magnitude % max;
	const progressRatio = progress / max;

	// Red -> orange -> green from 0 to +max (and beyond), red -> dark red
	// from 0 to -max (and beyond). Clamped so overflow just holds the end color.
	const t = Math.min(magnitude / max, 1);
	const activeColor =
		value < 0
			? lerpColor(startColor, negativeColor, t)
			: t <= 0.5
				? lerpColor(startColor, midColor, t / 0.5)
				: lerpColor(midColor, endColor, (t - 0.5) / 0.5);

	// Position on the ring for an absolute angle (radians, clockwise from 12
	// o'clock). Periodic, so angles beyond +-2π wrap to the right spot.
	const pointAt = (a: number) => ({
		x: center + radius * Math.sin(a),
		y: center - radius * Math.cos(a),
	});

	// Angle actually swept by the tip (0..2π), used for its rendered
	// position — full laps don't change where it visually sits.
	const tipAngle = sign * progressRatio * 2 * Math.PI;
	const tip = pointAt(tipAngle);
	const start = pointAt(0);
	const largeArcFlag = progressRatio > 0.5 ? 1 : 0;
	const sweepFlag = sign > 0 ? 1 : 0;
	const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${tip.x} ${tip.y}`;

	// Darkening trail as a true angular gradient (no discrete segments, so
	// no seams) — transparent right at the tip, opaque black one lap back.
	// Capped at one lap: further laps redraw the same span instead of
	// stacking. Authored in the clockwise direction and mirrored via
	// scaleX for negative (counter-clockwise) values.
	const tipDeg = progressRatio * 360;
	const trailSpanDeg = Math.min(magnitude / max, 1) * 360;
	// Peak trail darkness ramps up only past +-50%, reaching full
	// `trailOpacity` at +-100% — flat/no darkening below that.
	const trailOpacityFactor = Math.max(0, (t - 0.5) / 0.5);
	const trailColor = `rgba(0, 0, 0, ${trailOpacity * trailOpacityFactor})`;
	// `from` is the gradient's own origin — stop offsets below are relative
	// to it, not absolute angles. Starting at the tail and sweeping forward
	// to the tip (offset 0 = tail = dark, offset trailSpanDeg = tip = clear)
	// puts the fade where the swept arc actually is.
	const tailDeg = tipDeg - trailSpanDeg;
	// The tail's `strokeLinecap="round"` cap (only present when the arc
	// isn't a full lap) physically pokes out past `tailDeg` by strokeWidth/2
	// — extend the solid-dark region back by that same angle so the cap is
	// fully covered instead of poking out from under the gradient.
	const capMarginDeg =
		laps === 0 ? (strokeWidth / 2 / radius) * (180 / Math.PI) : 0;
	const trailGradient = `conic-gradient(from ${tailDeg - capMarginDeg}deg, ${trailColor} 0deg, ${trailColor} ${capMarginDeg}deg, transparent ${trailSpanDeg + capMarginDeg}deg, transparent 360deg)`;
	// A couple px of soft feather (rather than a hard 0-width stop) keeps the
	// mask's own antialiasing from mismatching the stroke's antialiased edge
	// and leaving stray pixels poking through the gradient.
	const maskFeather = 1;
	const innerRadius = Math.max(0, radius - strokeWidth / 2 - maskFeather);
	const outerRadius = radius + strokeWidth / 2 + maskFeather;
	const ringMask = `radial-gradient(circle at center, transparent ${innerRadius}px, black ${innerRadius + maskFeather}px, black ${outerRadius - maskFeather}px, transparent ${outerRadius}px)`;

	const trailStyle: CSSProperties = {
		position: "absolute",
		inset: 0,
		pointerEvents: "none",
		transform: `scaleX(${sign})`,
		backgroundImage: trailGradient,
		WebkitMaskImage: ringMask,
		maskImage: ringMask,
	};

	return (
		<div
			className={[styles.wrapper, className].filter(Boolean).join(" ")}
			style={{ width: size, height: size }}
		>
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
			>
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					stroke={trackColor}
					strokeWidth={strokeWidth}
				/>
				{laps > 0 ? (
					<circle
						className={styles.arc}
						cx={center}
						cy={center}
						r={radius}
						fill="none"
						stroke={activeColor}
						strokeWidth={strokeWidth}
					/>
				) : (
					progressRatio > 0 && (
						<path
							className={styles.arc}
							d={arcPath}
							fill="none"
							stroke={activeColor}
							strokeWidth={strokeWidth}
							strokeLinecap="round"
						/>
					)
				)}
			</svg>
			{magnitude > 0 && <div style={trailStyle} />}
			{magnitude > 0 && (
				<svg
					width={size}
					height={size}
					viewBox={`0 0 ${size} ${size}`}
					style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
				>
					<circle
						cx={tip.x}
						cy={tip.y}
						r={strokeWidth / 2}
						fill={activeColor}
					/>
				</svg>
			)}
			{showValue && (
				<div
					className={styles.value}
					style={{ fontSize: fontSize ?? size * textScaling }}
				>
					{children ?? `${formatCompact(value)}${unit}`}
				</div>
			)}
		</div>
	);
}
