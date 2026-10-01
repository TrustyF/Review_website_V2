"use client";
import {
	ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react";
import { createPortal } from "react-dom";
import { Lightbulb } from "lucide-react";
import { Clickable } from "@/components/ui/clickable";
import { useTips } from "@/components/tips/tips-context";
import type { TipId } from "@/components/tips/tip-ids";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./tip.module.sass";

// Same portal-to-body idea as ui/tooltip.tsx, but persistent until dismissed, and
// placed from its measured size so it stays on screen.

// Same server-render guard as Tooltip's.
const useIsomorphicLayoutEffect =
	typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Side = "top" | "bottom" | "left" | "right";

// Gap to the anchor and minimum distance from the screen edge, in px.
const GAP = 8;
const EDGE = 16;
// Keeps the arrow off the box's rounded corners when the box is shifted.
const ARROW_INSET = 12;
// Matches .tip's opacity transition.
const FADE_MS = 200;

type Placement = { top: number; left: number; side: Side; arrow: number };

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), Math.max(min, max));

// Viewport coordinates. Left/right fall back to bottom when they don't fit; top/bottom
// slide sideways to stay on screen, with the arrow kept on the anchor's center.
function place(
	anchor: DOMRect,
	width: number,
	height: number,
	preferred: Side,
): Placement {
	const viewportWidth = document.documentElement.clientWidth;
	let side = preferred;
	if (side === "right" && anchor.right + GAP + width > viewportWidth - EDGE) {
		side = "bottom";
	}
	if (side === "left" && anchor.left - GAP - width < EDGE) side = "bottom";

	const centerX = anchor.left + anchor.width / 2;
	const centerY = anchor.top + anchor.height / 2;

	if (side === "left" || side === "right") {
		const top = centerY - height / 2;
		const left =
			side === "right" ? anchor.right + GAP : anchor.left - GAP - width;
		return { top, left, side, arrow: height / 2 };
	}

	const top =
		side === "bottom" ? anchor.bottom + GAP : anchor.top - GAP - height;
	const left = clamp(centerX - width / 2, EDGE, viewportWidth - EDGE - width);
	const arrow = clamp(centerX - left, ARROW_INSET, width - ARROW_INSET);
	return { top, left, side, arrow };
}

type Props = {
	id: TipId;
	text: string;
	// Optional short list under the text, e.g. the difficulty levels.
	items?: { name: string; description: string }[];
	children: ReactNode;
	side?: Side;
	// Waits until this other tip has been seen, e.g. to follow it in sequence.
	after?: TipId;
};

// Unlike Tooltip's inline-block wrapper, this one is display:contents so wrapping
// a block-level control can't change its layout; its first element is the anchor.
export function Tip({
	id,
	text,
	items,
	children,
	side = "bottom",
	after,
}: Props) {
	const dict = useDictionary();
	const { isSeen, activeId, claim, release, markSeen, dismiss } = useTips();
	const wrapperRef = useRef<HTMLSpanElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const seen = isSeen(id);
	const ready = after === undefined || isSeen(after);
	// Not gated on `seen`: it's marked seen as soon as it shows, but stays up
	// until clicked or the page is left.
	const active = activeId === id;

	// Some controls render twice (desktop/mobile headers) with one hidden by CSS;
	// only the visible copy claims the one-tip-at-a-time slot. Re-runs when the slot frees up.
	useEffect(() => {
		if (seen || !ready || activeId !== null) return;
		const anchor = wrapperRef.current?.firstElementChild;
		if (anchor?.checkVisibility()) claim(id);
	}, [seen, ready, activeId, id, claim]);

	// Released on unmount only, so becoming seen doesn't hide the tip that's showing.
	useEffect(() => () => release(id), [id, release]);

	// Fades the box out first, then frees the slot (so a chained tip appears after the fade).
	const close = useCallback(() => {
		if (fadeTimeoutRef.current) return;
		if (boxRef.current) boxRef.current.dataset.closing = "";
		fadeTimeoutRef.current = setTimeout(() => {
			fadeTimeoutRef.current = null;
			dismiss(id);
		}, FADE_MS);
	}, [id, dismiss]);

	// On unmount mid-fade there's nothing left to fade; release() frees the slot instead.
	useEffect(
		() => () => {
			if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
		},
		[],
	);

	// Visible copy only: marks it seen, and any press anywhere dismisses it. The click still
	// goes through, so pressing the anchor itself also does its normal thing.
	useEffect(() => {
		if (!active) return;
		const anchor = wrapperRef.current?.firstElementChild;
		if (!anchor?.checkVisibility()) return;
		markSeen(id);
		const onPointerDown = () => close();
		document.addEventListener("pointerdown", onPointerDown, { capture: true });
		return () =>
			document.removeEventListener("pointerdown", onPointerDown, {
				capture: true,
			});
	}, [active, id, markSeen, close]);

	// Positioned imperatively before paint (no state round-trip), in page coordinates
	// with position:absolute so the browser scrolls it with the page.
	useIsomorphicLayoutEffect(() => {
		if (!active) return;
		const anchor = wrapperRef.current?.firstElementChild;
		const box = boxRef.current;
		if (!anchor || !box) return;

		function update() {
			if (!anchor || !box) return;
			// The hidden desktop/mobile duplicate keeps its box hidden.
			if (!anchor.checkVisibility()) {
				box.style.visibility = "hidden";
				return;
			}
			const p = place(
				anchor.getBoundingClientRect(),
				box.offsetWidth,
				box.offsetHeight,
				side,
			);
			box.dataset.side = p.side;
			box.style.top = `${p.top + window.scrollY}px`;
			box.style.left = `${p.left + window.scrollX}px`;
			box.style.setProperty("--arrow-offset", `${p.arrow}px`);
			box.style.visibility = "visible";
		}

		update();
		let frame = 0;
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(update);
		};
		// Scroll only matters for anchors inside inner scroll areas; the observer
		// catches size changes (fonts loading, layout shifts) on either element.
		window.addEventListener("scroll", schedule, {
			capture: true,
			passive: true,
		});
		window.addEventListener("resize", schedule);
		const observer = new ResizeObserver(schedule);
		observer.observe(anchor);
		observer.observe(box);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule, { capture: true });
			window.removeEventListener("resize", schedule);
			observer.disconnect();
		};
	}, [active, side]);

	const popup =
		active && typeof document !== "undefined"
			? createPortal(
					// Pointer presses are handled by the document listener above; onClick covers Enter/Space.
					<Clickable
						ref={boxRef}
						className={`${styles.tip} ${after ? styles.tip_chained : ""}`}
						onClick={close}>
						<span className={styles.title}>
							<Lightbulb size={16} strokeWidth={2} />
							{dict.tips.title}
							<span className={styles.label}>— {dict.tips.labels[id]}</span>
						</span>
						<p>{text}</p>
						{items && (
							<ul className={styles.items}>
								{items.map((item) => (
									<li key={item.name}>
										<span className={styles.item_name}>{item.name}</span> —{" "}
										{item.description}
									</li>
								))}
							</ul>
						)}
						<div className={styles.arrow} />
					</Clickable>,
					document.body,
				)
			: null;

	return (
		<span ref={wrapperRef} className={styles.wrapper}>
			{children}
			{popup}
		</span>
	);
}
