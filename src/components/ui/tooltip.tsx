"use client";
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Hitbox } from "@/components/ui/hitbox";
import styles from "./tooltip.module.sass";

// Avoids React's "useLayoutEffect does nothing on the server" warning —
// this component still gets server-rendered, where there's no trigger
// element to measure anyway (isVisible can't be true yet).
const useIsomorphicLayoutEffect =
	typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Side = "top" | "bottom" | "left" | "right";

const TOOLTIP_SIDE_CLASS: Record<Side, string | undefined> = {
	top: styles.tooltip_top,
	bottom: styles.tooltip_bottom,
	left: styles.tooltip_left,
	right: styles.tooltip_right,
};

const ARROW_SIDE_CLASS: Record<Side, string | undefined> = {
	top: styles.arrow_top,
	bottom: styles.arrow_bottom,
	left: styles.arrow_left,
	right: styles.arrow_right,
};

// Gap between the trigger and the tooltip box, in px — same value the old
// CSS-relative `calc(100% + 8px)` used, just applied in JS now.
const GAP = 8;

type Position = { top: number; left: number };

function positionFor(rect: DOMRect, side: Side): Position {
	switch (side) {
		case "top":
			return { top: rect.top - GAP, left: rect.left + rect.width / 2 };
		case "bottom":
			return { top: rect.bottom + GAP, left: rect.left + rect.width / 2 };
		case "left":
			return { top: rect.top + rect.height / 2, left: rect.left - GAP };
		case "right":
			return { top: rect.top + rect.height / 2, left: rect.right + GAP };
	}
}

type Props = {
	content: ReactNode;
	children: ReactNode;
	// Which side of the trigger the tooltip opens toward — the arrow always
	// points back at the trigger from the tooltip's opposite edge.
	side?: Side;
	className?: string | undefined;
	// Extra invisible hover margin around `children`, in px — for a trigger
	// too small to hover accurately (the difficulty notch is 10x10px). Reuses
	// Hitbox, same technique it already uses for click targets, just wired to
	// hover here instead. Omitted (the default) skips Hitbox entirely — no
	// point adding the extra overlay element for a trigger that's already big
	// enough to hover on its own.
	hitboxPadding?: number;
};

// Wraps `children` (the hover target) and shows `content` in a small
// arrowed popup on hover — drop it around anything (a button, an icon, a
// whole card) without that thing needing to know it has a tooltip, same
// "wrap and don't touch the child" idea as Hitbox.
//
// The popup itself is portaled straight to document.body and positioned via
// getBoundingClientRect() + position: fixed, rather than sitting inside the
// trigger's own DOM subtree with position: absolute — an ancestor with
// overflow: hidden (a grid cell, a scroll container, ...) would otherwise
// clip it, and an ancestor that starts its own stacking context (transform,
// opacity < 1, ...) could make its z-index lose to something it should
// render above. On its own layer at the document root, neither can happen.
export function Tooltip({
	content,
	children,
	side = "top",
	className,
	hitboxPadding,
}: Props) {
	const [isVisible, setIsVisible] = useState(false);
	const triggerRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<Position | null>(null);

	// Measured once when the tooltip opens, not tracked continuously — a
	// hover tooltip closes (via mouseleave) the moment the trigger scrolls
	// out from under a stationary cursor in practice, so there's no ongoing
	// scroll/resize case worth the extra listener plumbing here.
	useIsomorphicLayoutEffect(() => {
		if (!isVisible || !triggerRef.current) return;
		setPosition(positionFor(triggerRef.current.getBoundingClientRect(), side));
	}, [isVisible, side]);

	const show = () => setIsVisible(true);
	const hide = () => setIsVisible(false);

	const popup =
		isVisible && position && typeof document !== "undefined"
			? createPortal(
					<div
						className={`${styles.tooltip} ${TOOLTIP_SIDE_CLASS[side]}`}
						style={{ top: position.top, left: position.left }}>
						{content}
						<div className={`${styles.arrow} ${ARROW_SIDE_CLASS[side]}`} />
					</div>,
					document.body,
				)
			: null;

	if (hitboxPadding) {
		return (
			<div
				ref={triggerRef}
				className={[styles.wrapper, className].filter(Boolean).join(" ")}>
				{/* Hitbox's own wrapper div sits between this element (which is
				    whatever size `className` actually gives it — e.g. the
				    difficulty notch's 10x10px) and `children` — without an
				    explicit fill here, a `children` that sizes itself as a
				    percentage of its parent (the notch's <svg>, 100%/100%)
				    would have nothing to resolve that percentage against. */}
				<Hitbox
					padding={hitboxPadding}
					onMouseEnter={show}
					onMouseLeave={hide}
					style={{ width: "100%", height: "100%" }}>
					{children}
				</Hitbox>
				{popup}
			</div>
		);
	}

	return (
		<div
			ref={triggerRef}
			className={[styles.wrapper, className].filter(Boolean).join(" ")}
			onMouseEnter={show}
			onMouseLeave={hide}>
			{children}
			{popup}
		</div>
	);
}
