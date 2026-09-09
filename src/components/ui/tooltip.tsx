"use client";
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Hitbox } from "@/components/ui/hitbox";
import styles from "./tooltip.module.sass";

// Avoids React's "useLayoutEffect does nothing on the server" warning — there's
// no trigger element to measure server-side anyway (isVisible can't be true yet).
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

// Hover must hold still this long before the tooltip appears, so a cursor just passing over the trigger doesn't flash it.
const SHOW_DELAY = 500;

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
	// Extra invisible hover margin around `children`, in px — for a trigger too small
	// to hover accurately (the difficulty notch is 10x10px). Reuses Hitbox. Omitted skips it.
	hitboxPadding?: number;
};

// Wraps `children` (the hover target) and shows `content` in a small arrowed popup
// on hover, same "wrap and don't touch the child" idea as Hitbox.

// Portaled to document.body and positioned via getBoundingClientRect() + position:
// fixed (not absolute inside the trigger) so an ancestor can't clip or bury it.
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
	const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Measured once on open, not tracked continuously — a hover tooltip closes via
	// mouseleave the moment the trigger scrolls out from under the cursor anyway.
	useIsomorphicLayoutEffect(() => {
		if (!isVisible || !triggerRef.current) return;
		setPosition(positionFor(triggerRef.current.getBoundingClientRect(), side));
	}, [isVisible, side]);

	// Clears any pending show on unmount so it can't fire after the trigger is gone.
	useEffect(() => {
		return () => {
			if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
		};
	}, []);

	// Also used as the mousemove handler — restarting the timer on every move means
	// the cursor has to actually stop, not just stay within the trigger, before it shows.
	const show = () => {
		if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
		showTimeoutRef.current = setTimeout(() => setIsVisible(true), SHOW_DELAY);
	};
	const hide = () => {
		if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
		setIsVisible(false);
	};

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
				{/* Without an explicit fill, a `children` sized as a percentage
				    (the notch's <svg>, 100%/100%) has nothing to resolve against. */}
				<Hitbox
					padding={hitboxPadding}
					onMouseEnter={show}
					onMouseMove={show}
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
			onMouseMove={show}
			onMouseLeave={hide}>
			{children}
			{popup}
		</div>
	);
}
