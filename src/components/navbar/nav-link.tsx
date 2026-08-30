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
	// label stays visually hidden at every desktop width rather than
	// width-gated by a tier (see .link_label_icon_only, nav-bar.module.sass),
	// with `children` also moved to aria-label/title so the link's name is
	// exposed to screen readers and as a hover tooltip while it's hidden.
	// Still a real element in the DOM (not omitted) so the mobile drawer's
	// own reveal rule — same one every tiered label already gets — can bring
	// it back once there's room for one.
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
					className={`${style.nav_icon} ${iconOnly ? style.nav_icon_always : style[`nav_icon_tier${collapseTier}`]}`}
					// fill={isActive ? "currentColor" : "none"}
				/>
			)}
			{/* Collapses away below $navbar-collapse-width (see nav-bar.module
			.sass's .link_label), leaving just the icon above — every NavLink
			call site is given an icon for exactly this reason, so nothing
			disappears entirely at narrow widths. iconOnly uses the same
			always-hidden-until-the-drawer class instead of a tier — see its
			own comment above. */}
			<span
				className={
					iconOnly
						? style.link_label_icon_only
						: style[`link_label_tier${collapseTier}`]
				}>
				{children}
			</span>
		</Link>
	);
}
