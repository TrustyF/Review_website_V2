"use client";
import { useState } from "react";
import { Link } from "@/components/ui/link";
import styles from "./scatter-dots.module.sass";

export type ScatterDot = {
	// label/detail show in a tooltip on hover; href makes the dot a link.
	label?: string;
	detail?: string;
	href?: string;
};

type Props = {
	points: ScatterDot[];
	// Percent offsets of dot i inside the (position: relative) plot.
	position: (i: number) => { left: string; top: string };
	color: (i: number) => string;
	// Size/opacity of a resting dot; hover state comes from this component.
	dotClassName?: string | undefined;
};

// A scatter plot's dots, plus one shared hover tooltip.
export function ScatterDots({ points, position, color, dotClassName }: Props) {
	const [hovered, setHovered] = useState<number | null>(null);
	const hoveredPoint = hovered != null ? points[hovered] : undefined;

	return (
		<>
			{points.map((p, i) => {
				const dotProps = {
					className: `${styles.dot} ${dotClassName ?? ""}`,
					"data-active": hovered === i,
					style: { ...position(i), background: color(i) },
					onMouseEnter: () => setHovered(p.label ? i : null),
					onMouseLeave: () => setHovered(null),
				};
				// Out of the tab order: hundreds of dots would swamp keyboard navigation.
				return p.href ? (
					<Link
						// biome-ignore lint/suspicious/noArrayIndexKey: points have no identity
						key={i}
						href={p.href}
						tabIndex={-1}
						aria-label={p.label}
						{...dotProps}
					/>
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: points have no identity
					<span key={i} {...dotProps} />
				);
			})}
			{hovered != null && hoveredPoint?.label && (
				<span className={styles.tooltip} style={position(hovered)}>
					<span className={styles.tooltip_title}>{hoveredPoint.label}</span>
					{hoveredPoint.detail && (
						<span className={styles.tooltip_detail}>{hoveredPoint.detail}</span>
					)}
				</span>
			)}
		</>
	);
}
