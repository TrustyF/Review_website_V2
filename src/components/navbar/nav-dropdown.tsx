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
	// For an action item (e.g. sign out); href can be a "#" placeholder since
	// this runs in place of the (prevented) navigation.
	onClick?: () => void;
};

type Props = {
	label: string;
	icon?: LucideIcon | NavIcon;
	items: Item[];
	// Hides the sliding label_stack, moving `label` to aria-label/title.
	iconOnly?: boolean;
	// Which side the panel grows from; "right" for a trigger pinned against
	// the navbar's right edge (see .panel_right) to avoid overflow.
	align?: "left" | "right";
};

// Marks every NavDropdown's root <details> so close helpers can find them all.
const DROPDOWN_SELECTOR = "details[data-nav-dropdown]";

// Called from nav-bar.tsx's <nav> click handler so any link click closes
// whatever dropdown is open, rather than leaving it hanging.
export function closeAllNavDropdowns() {
	document
		.querySelectorAll<HTMLDetailsElement>(DROPDOWN_SELECTOR)
		.forEach((el) => {
			el.open = false;
		});
}

// <details> has no built-in mutually-exclusive group; shared by both the
// toggle listener and handleMouseEnter so click and hover opens agree.
function closeOtherDropdowns(current: HTMLDetailsElement) {
	document
		.querySelectorAll<HTMLDetailsElement>(DROPDOWN_SELECTOR)
		.forEach((other) => {
			if (other !== current) other.open = false;
		});
}

// Grace window after the pointer leaves before the panel actually closes
// (overshoot/diagonal moves), canceled if the pointer returns.
const CLOSE_DELAY_MS = 200;

// Key for the group's own default label; each item's href keys its variant.
const GROUP_LABEL_KEY = "__group__";

// Matches .label's transition duration — how long a variant stays flagged
// "exiting" before it's safe to drop that flag.
const LABEL_TRANSITION_MS = 200;

// Native <details>/<summary> gives open/close and keyboard support for free.
export function NavDropdown({
	label,
	icon: Icon,
	items,
	iconOnly = false,
	align = "left",
}: Props) {
	const pathname = usePathname();
	// Trigger shows the active child's label instead of the group label,
	// so you know where you are without opening the panel.
	const activeItem = items.find((item) => isNavActive(pathname, item.href));
	const activeLabelKey = activeItem ? activeItem.href : GROUP_LABEL_KEY;
	const detailsRef = useRef<HTMLDetailsElement>(null);
	const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Adjusted during render rather than in an effect, which would catch up
	// a frame late and miss the leaving label's "exiting" style in time.
	const [lastActiveLabelKey, setLastActiveLabelKey] = useState(activeLabelKey);
	const [previousActiveKey, setPreviousActiveKey] = useState(activeLabelKey);
	if (activeLabelKey !== lastActiveLabelKey) {
		setPreviousActiveKey(lastActiveLabelKey);
		setLastActiveLabelKey(activeLabelKey);
	}

	// previousActiveKey must survive just long enough to play the exit
	// transition, then reset — otherwise it stays pinned at translateY(-100%)
	// forever, and next time that variant reactivates it slides down from
	// above instead of up from below (the "wrong way" bug this avoids).
	useEffect(() => {
		if (previousActiveKey === activeLabelKey) return;
		const timeout = setTimeout(() => {
			setPreviousActiveKey(activeLabelKey);
		}, LABEL_TRANSITION_MS);
		return () => clearTimeout(timeout);
	}, [previousActiveKey, activeLabelKey]);

	// Covers a click/keyboard-driven open (native "toggle" event); hover
	// opens call closeOtherDropdowns directly since script-set .open doesn't
	// reliably fire "toggle" everywhere.
	useEffect(() => {
		const el = detailsRef.current;
		if (!el) return;

		function handleToggle() {
			if (el?.open) closeOtherDropdowns(el);
		}

		el.addEventListener("toggle", handleToggle);
		return () => el.removeEventListener("toggle", handleToggle);
	}, []);

	// Clears any pending close if this dropdown unmounts mid-timeout.
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

	// On a no-hover device the panel would only be reachable via the bare
	// chevron, since preventDefault on the Link also cancels <summary>'s
	// native toggle for the same click — so toggle it manually here instead.
	function handleTriggerLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
		if (!window.matchMedia("(hover: none)").matches) return;
		e.preventDefault();
		// nav-bar.tsx's delegated handler closes every dropdown on any link
		// click, assuming real navigation — not true here, so stop it bubbling.
		e.stopPropagation();
		const el = detailsRef.current;
		if (!el) return;
		el.open = !el.open;
		if (el.open) closeOtherDropdowns(el);
	}

	// All label variants stay mounted, stacked in one grid cell sized to the
	// widest, so the trigger's width is fixed and switching never reflows.
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
				{/* A click here navigates straight to the first item (its
				preventDefault also suppresses <summary>'s toggle); the panel
				stays reachable via hover, keyboard, or the chevron — except on
				no-hover devices, where handleTriggerLinkClick opens it instead. */}
				<Link
					href={items[0]?.href ?? "#"}
					className={style.trigger_link}
					onClick={handleTriggerLinkClick}
					aria-label={iconOnly ? label : undefined}
					title={iconOnly ? label : undefined}>
					{/* Lucide has no filled icon set — "filled" is just fill switched on. */}
					{Icon && (
						<Icon
							size={14}
							className={`${style.nav_icon} ${iconOnly ? style.nav_icon_always : ""}`}
							// fill={activeItem ? "currentColor" : "none"}
						/>
					)}
					{/* Skipped (not just hidden) for iconOnly, so aria-label is the
					trigger's only accessible name, not a redundant one. */}
					{!iconOnly && (
						<span className={style.label_stack}>
							{labelVariants.map((variant) => {
								const isActive = variant.key === activeLabelKey;
								// Only the variant that just lost active status gets "exiting".
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
