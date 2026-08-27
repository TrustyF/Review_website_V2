"use client";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { isNavActive } from "@/lib/nav-active";
import type { LucideIcon, NavIcon } from "@/components/navbar/nav-types";
import style from "./nav-dropdown.module.sass";

type Item = {
	href: string;
	label: string;
	icon?: LucideIcon | NavIcon;
	// For an item that performs an action instead of navigating (e.g. sign
	// out) — href can be a placeholder ("#") in that case, since it's never
	// actually followed: the panel link's own click is prevented and this
	// runs in its place instead.
	onClick?: () => void;
};

type Props = {
	label: string;
	icon?: LucideIcon | NavIcon;
	items: Item[];
	// Which staggered collapse breakpoint this dropdown's label text hides
	// at — see nav-bar.tsx's own COLLAPSE_TIER map for how tiers are
	// assigned per nav_group (1 = widest/collapses first, rightmost group).
	// Ignored when iconOnly is set (there's no label to collapse).
	collapseTier?: number;
	// Same code-level opt-in as NavLink's own iconOnly (nav-bar.tsx) — the
	// trigger's sliding label_stack stays out of the DOM at every width
	// instead of just collapsing at collapseTier's breakpoint, with `label`
	// moved to aria-label/title so the trigger's name is still exposed to
	// screen readers and as a hover tooltip.
	iconOnly?: boolean;
	// Which side of the trigger the panel grows from — "right" for a
	// dropdown pinned against the navbar's own right edge (see
	// nav-dropdown.module.sass's .panel_right), so the panel stays under the
	// trigger instead of growing off the edge of the viewport.
	align?: "left" | "right";
};

// Marks every NavDropdown's root <details> so the "close other dropdowns"
// helper below (and closeAllNavDropdowns, called from nav-bar.tsx) can find
// them all, regardless of how many are rendered.
const DROPDOWN_SELECTOR = "details[data-nav-dropdown]";

// nav-bar.tsx calls this from a click handler on the whole <nav> — clicking
// any link (a dropdown's own item, or an unrelated top-level one) should
// close whatever dropdown is open, not just leave it hanging open after the
// page underneath it has already changed.
export function closeAllNavDropdowns() {
	document
		.querySelectorAll<HTMLDetailsElement>(DROPDOWN_SELECTOR)
		.forEach((el) => {
			el.open = false;
		});
}

// <details> has no built-in mutually-exclusive group (that's <input
// type="radio"> only) — shared by the toggle listener (a click/keyboard
// open) and handleMouseEnter (a hover open) below, so both paths agree on
// what "opening this one" does to every other dropdown.
function closeOtherDropdowns(current: HTMLDetailsElement) {
	document
		.querySelectorAll<HTMLDetailsElement>(DROPDOWN_SELECTOR)
		.forEach((other) => {
			if (other !== current) other.open = false;
		});
}

// How long the panel stays open after the pointer leaves before it actually
// closes — the trigger-to-panel gap itself is already bridged with padding
// rather than a raw offset (see .panel in nav-dropdown.module.sass) so
// crossing it doesn't fire a real mouseleave in the first place; this delay
// is just a grace window for everything else (a brief overshoot past the
// panel's own edge, a diagonal move that clips the corner), canceled the
// instant the pointer lands back on the trigger or the panel.
const CLOSE_DELAY_MS = 200;

// Key for the group's own default label ("Media"), alongside each item's
// href as the key for its label variant ("Movies").
const GROUP_LABEL_KEY = "__group__";

// Matches .label's own transition duration in nav-dropdown.module.sass —
// how long a variant needs to stay flagged "exiting" before it's safe to
// drop that flag (see the effect below for why dropping it matters).
const LABEL_TRANSITION_MS = 200;

// Native <details>/<summary> rather than useState + useOutsideClick — same
// pattern DevMenu already uses for its own floating panel, and it comes
// with open/close and keyboard support for free.
export function NavDropdown({
	label,
	icon: Icon,
	items,
	collapseTier = 1,
	iconOnly = false,
	align = "left",
}: Props) {
	const pathname = usePathname();
	// Trigger shows the active child's own label ("Movies") rather than the
	// group label ("Media") once you're on one of its pages — tells you
	// where you are without having to open the panel first.
	const activeItem = items.find((item) => isNavActive(pathname, item.href));
	const activeLabelKey = activeItem ? activeItem.href : GROUP_LABEL_KEY;
	const detailsRef = useRef<HTMLDetailsElement>(null);
	const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// State adjusted during render (the React-sanctioned alternative to
	// reading a ref's value while rendering) rather than a ref written from
	// an effect — an effect would only catch up a frame late, so the label
	// that's leaving wouldn't get its distinct "exiting" style until the
	// render after the one where the incoming label already turned active.
	const [lastActiveLabelKey, setLastActiveLabelKey] = useState(activeLabelKey);
	const [previousActiveKey, setPreviousActiveKey] = useState(activeLabelKey);
	if (activeLabelKey !== lastActiveLabelKey) {
		setPreviousActiveKey(lastActiveLabelKey);
		setLastActiveLabelKey(activeLabelKey);
	}

	// previousActiveKey has to survive long enough for its variant to
	// actually play the exit transition (translateY(0) -> translateY(-100%)),
	// but not a moment longer — left alone, it would stay equal to whatever
	// key last exited forever (nothing overwrites it once navigation stops),
	// pinning that variant at translateY(-100%) instead of letting it settle
	// back to the same translateY(100%) resting spot every other inactive
	// variant sits in. That's invisible in the moment (opacity: 0 either
	// way), but the next time that variant becomes active again, it would
	// then animate downward into place from above instead of upward from
	// below — the exact "sometimes slides the wrong way" bug this avoids.
	// Setting it back to activeLabelKey (rather than some null/none sentinel)
	// is enough: it makes isExiting false for everyone, same as if this
	// variant had never exited in the first place.
	useEffect(() => {
		if (previousActiveKey === activeLabelKey) return;
		const timeout = setTimeout(() => {
			setPreviousActiveKey(activeLabelKey);
		}, LABEL_TRANSITION_MS);
		return () => clearTimeout(timeout);
	}, [previousActiveKey, activeLabelKey]);

	// Covers a click/keyboard-driven open (the native "toggle" event) — a
	// hover-driven open below calls closeOtherDropdowns directly instead,
	// since not every browser queues "toggle" for a script-set `.open` the
	// same way it does for a real interaction.
	useEffect(() => {
		const el = detailsRef.current;
		if (!el) return;

		function handleToggle() {
			if (el?.open) closeOtherDropdowns(el);
		}

		el.addEventListener("toggle", handleToggle);
		return () => el.removeEventListener("toggle", handleToggle);
	}, []);

	// Clears any pending close if this dropdown (or another one) unmounts
	// mid-timeout — e.g. the label variants above change on navigation, but
	// this covers the panel itself going away entirely.
	useEffect(() => {
		return () => {
			if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
		};
	}, []);

	function handleMouseEnter() {
		if (closeTimeoutRef.current) {
			clearTimeout(closeTimeoutRef.current);
			closeTimeoutRef.current = null;
		}
		const el = detailsRef.current;
		if (!el) return;
		if (!el.open) el.open = true;
		closeOtherDropdowns(el);
	}

	function handleMouseLeave() {
		closeTimeoutRef.current = setTimeout(() => {
			const el = detailsRef.current;
			if (el) el.open = false;
			closeTimeoutRef.current = null;
		}, CLOSE_DELAY_MS);
	}

	// On a device that can't hover (see the (hover: none) check below), the
	// panel would otherwise only be reachable by tapping the bare chevron —
	// handleMouseEnter never fires, and the trigger_link's own click (see its
	// own comment below) navigates straight past it every time. Toggling the
	// details element manually mirrors what <summary>'s native click handling
	// would have done on its own; it's suppressed here because preventDefault
	// (needed to stop the Link underneath from navigating) also cancels
	// <summary>'s default action for the same click, not just the Link's.
	function handleTriggerLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
		if (!window.matchMedia("(hover: none)").matches) return;
		e.preventDefault();
		// nav-bar.tsx's own delegated click handler closes every dropdown on
		// any "a, button" click, on the assumption that a click through a
		// link is a real navigation the panel should close behind — not true
		// here, since this click isn't going anywhere. Left alone, that
		// handler would still see this click bubble past it and immediately
		// close the very panel just opened below.
		e.stopPropagation();
		const el = detailsRef.current;
		if (!el) return;
		el.open = !el.open;
		if (el.open) closeOtherDropdowns(el);
	}

	// Every label variant (the group label plus each item's) stays mounted,
	// stacked into the same CSS grid cell in nav-dropdown.module.sass — the
	// cell sizes itself to the widest one up front, so the trigger's width
	// is fixed from the start and never reflows the rest of the navbar as
	// the active variant changes. Only the active variant's opacity/
	// transform is toggled, which is what produces the slide.
	const labelVariants = [
		{ key: GROUP_LABEL_KEY, text: label },
		...items.map((item) => ({ key: item.href, text: item.label })),
	];

	return (
		<details
			ref={detailsRef}
			data-nav-dropdown
			className={style.wrapper}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}>
			<summary
				className={style.trigger}
				aria-current={activeItem ? "page" : undefined}>
				{/* A click landing here (rather than on the bare chevron) is
				handed to this Link, whose own preventDefault on click also
				suppresses <summary>'s native open-toggle as a side effect — so
				a mouse click navigates straight to the first item instead of
				just opening the panel, while the panel is still reachable by
				hover, by keyboard (Enter on the focused <summary> targets
				<summary> itself, not this Link, so toggling still applies),
				or by clicking the chevron directly. On a device that can't
				hover, though, none of those other paths are actually
				available — handleTriggerLinkClick above steps in and opens
				the panel instead of navigating, for exactly that case. */}
				<Link
					href={items[0]?.href ?? "#"}
					className={style.trigger_link}
					onClick={handleTriggerLinkClick}
					aria-label={iconOnly ? label : undefined}
					title={iconOnly ? label : undefined}>
					{/* Lucide has no separate filled icon set, so "filled" is just
					this icon's own fill switched on rather than a different asset. */}
					{Icon && (
						<Icon
							size={14}
							className={style.nav_icon}
							// fill={activeItem ? "currentColor" : "none"}
						/>
					)}
					{/* Skipped entirely for iconOnly triggers instead of just hidden,
					so their aria-label above is the trigger's only accessible name
					rather than a redundant one — same reasoning as NavLink's own
					iconOnly (nav-bar.tsx). */}
					{!iconOnly && (
						<span
							className={`${style.label_stack} ${style[`label_stack_tier${collapseTier}`]}`}>
							{labelVariants.map((variant) => {
								const isActive = variant.key === activeLabelKey;
								// Only the variant that just lost active status gets
								// "exiting" — everything else rests in the default
								// (below, invisible) position, ready to slide up into
								// place if it becomes active later.
								const isExiting =
									!isActive &&
									variant.key === previousActiveKey &&
									previousActiveKey !== activeLabelKey;
								return (
									<span
										key={variant.key}
										className={`${style.label} ${isActive ? style.active : isExiting ? style.exiting : ""}`}
										aria-hidden={!isActive}>
										{variant.text}
									</span>
								);
							})}
						</span>
					)}
				</Link>
				<ChevronDown size={14} className={style.chevron} />
			</summary>
			<div
				className={`${style.panel} ${align === "right" ? style.panel_right : ""}`}>
				<div className={style.panel_content}>
					{items.map((item) => {
						const ItemIcon = item.icon;
						const isItemActive = isNavActive(pathname, item.href);
						const onClick = item.onClick;
						return (
							<Link
								key={item.href}
								href={item.href}
								className={style.link}
								aria-current={isItemActive ? "page" : undefined}
								{...(onClick && {
									onClick: (e: React.MouseEvent) => {
										e.preventDefault();
										onClick();
									},
								})}>
								{ItemIcon && (
									<ItemIcon
										size={14}
										className={style.nav_icon}
										fill={isItemActive ? "currentColor" : "none"}
									/>
								)}
								{item.label}
							</Link>
						);
					})}
				</div>
			</div>
		</details>
	);
}
