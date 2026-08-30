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
	// Label stays hidden on desktop with `children` moved to aria-label/title
	// instead, so the link's name is still exposed to screen readers and as
	// a hover tooltip. Still a real element in the DOM (not omitted) so the
	// mobile drawer can bring the label back.
	iconOnly?: boolean;
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
					className={`${style.nav_icon} ${iconOnly ? style.nav_icon_always : ""}`}
					// fill={isActive ? "currentColor" : "none"}
				/>
			)}
			<span className={iconOnly ? style.link_label_icon_only : style.link_label}>
				{children}
			</span>
		</Link>
	);
}
