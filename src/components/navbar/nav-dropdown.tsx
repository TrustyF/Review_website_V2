"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { isNavActive } from "@/lib/nav-active";
import style from "./nav-dropdown.module.sass";

type Item = {
	href: string;
	label: string;
	icon?: LucideIcon;
};

type Props = {
	label: string;
	icon?: LucideIcon;
	items: Item[];
};

// Marks every NavDropdown's root <details> so the "close other dropdowns"
// effect below (and closeAllNavDropdowns, called from nav-bar.tsx) can find
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

// Key for the group's own default label ("Media"), alongside each item's
// href as the key for its label variant ("Movies").
const GROUP_LABEL_KEY = "__group__";

// Native <details>/<summary> rather than useState + useOutsideClick — same
// pattern DevMenu already uses for its own floating panel, and it comes
// with open/close and keyboard support for free.
export function NavDropdown({ label, icon: Icon, items }: Props) {
	const pathname = usePathname();
	// Trigger shows the active child's own label ("Movies") rather than the
	// group label ("Media") once you're on one of its pages — tells you
	// where you are without having to open the panel first.
	const activeItem = items.find((item) => isNavActive(pathname, item.href));
	const activeLabelKey = activeItem ? activeItem.href : GROUP_LABEL_KEY;
	const detailsRef = useRef<HTMLDetailsElement>(null);

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

	// <details> has no built-in mutually-exclusive group (that's <input
	// type="radio"> only), so opening one leaves any other already-open
	// dropdown sitting open too. This listens for this dropdown's own native
	// "toggle" event and, on open, reaches out to close every other one —
	// simpler than routing shared open state through context for two
	// siblings that otherwise don't need to know about each other.
	useEffect(() => {
		const el = detailsRef.current;
		if (!el) return;

		function handleToggle() {
			if (!el?.open) return;
			document
				.querySelectorAll<HTMLDetailsElement>(DROPDOWN_SELECTOR)
				.forEach((other) => {
					if (other !== el) other.open = false;
				});
		}

		el.addEventListener("toggle", handleToggle);
		return () => el.removeEventListener("toggle", handleToggle);
	}, []);

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
		<details ref={detailsRef} data-nav-dropdown className={style.wrapper}>
			<summary
				className={style.trigger}
				aria-current={activeItem ? "page" : undefined}>
				{/* Lucide has no separate filled icon set, so "filled" is just
				this icon's own fill switched on rather than a different asset. */}
				{Icon && <Icon size={14} fill={activeItem ? "currentColor" : "none"} />}
				<span className={style.label_stack}>
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
				<ChevronDown size={14} className={style.chevron} />
			</summary>
			<div className={style.panel}>
				{items.map((item) => {
					const ItemIcon = item.icon;
					const isItemActive = isNavActive(pathname, item.href);
					return (
						<Link
							key={item.href}
							href={item.href}
							className={style.link}
							aria-current={isItemActive ? "page" : undefined}>
							{ItemIcon && (
								<ItemIcon
									size={14}
									fill={isItemActive ? "currentColor" : "none"}
								/>
							)}
							{item.label}
						</Link>
					);
				})}
			</div>
		</details>
	);
}
