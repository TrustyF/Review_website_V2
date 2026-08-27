import { Link } from "@/components/ui/link";
import { isNavActive } from "@/lib/nav-active";
import type { LucideIcon, NavIcon } from "@/components/navbar/nav-types";
import style from "./nav-bar.module.sass";

type NavLinkProps = {
	href: string;
	icon?: LucideIcon | NavIcon;
	// CSS module class lookups are typed as possibly-undefined (an unknown
	// key would silently produce `undefined`), so this matches that rather
	// than requiring callers to non-null-assert every style.xxx they pass.
	className: string | undefined;
	pathname: string;
	children: React.ReactNode;
	// Code-level opt-in (as opposed to the viewport-driven collapse every
	// other label already goes through — see collapseTier below) — the
	// label stays out of the DOM at every width rather than just visually
	// hidden, with `children` moved to aria-label/title so the link's name
	// is still exposed to screen readers and as a hover tooltip.
	iconOnly?: boolean;
	// Which staggered collapse breakpoint this link's label hides at — see
	// COLLAPSE_TIER (nav-constants.ts) for how tiers are assigned per
	// nav_group. Ignored when iconOnly is set (there's no label to collapse).
	collapseTier?: number;
	// Defaults to false (same as Link's own default) — leave unset for
	// anything dynamic/session-scoped (e.g. /account). Pass true only for a
	// destination that's cheap to prefetch (static/ISR, no per-user data at
	// the top level), since this is a single always-visible nav item, not a
	// grid of many links.
	prefetch?: boolean;
};

// Every plain top-level item (as opposed to a NavDropdown) goes through
// here so an icon stays optional without repeating the same "icon &&
// <Icon />" line at every one of these call sites.
export function NavLink({
	href,
	icon: Icon,
	className,
	pathname,
	children,
	iconOnly = false,
	collapseTier = 4,
	prefetch = false,
}: NavLinkProps) {
	const isActive = isNavActive(pathname, href);
	const label = typeof children === "string" ? children : undefined;
	return (
		<Link
			href={href}
			prefetch={prefetch}
			className={className}
			aria-current={isActive ? "page" : undefined}
			aria-label={iconOnly ? label : undefined}
			title={iconOnly ? label : undefined}>
			{/* Lucide ships outline-only icons — no separate filled set — so
			"filled" here is just handing the same icon a fill color instead
			of "none" on top of its existing stroke. */}
			{Icon && (
				<Icon
					size={14}
					className={style.nav_icon}
					// fill={isActive ? "currentColor" : "none"}
				/>
			)}
			{/* Collapses away below $navbar-collapse-width (see nav-bar.module
			.sass's .link_label), leaving just the icon above — every NavLink
			call site is given an icon for exactly this reason, so nothing
			disappears entirely at narrow widths. Skipped entirely for
			iconOnly links instead of just hidden, so their aria-label above
			is the link's only accessible name rather than a redundant one. */}
			{!iconOnly && (
				<span className={style[`link_label_tier${collapseTier}`]}>
					{children}
				</span>
			)}
		</Link>
	);
}
