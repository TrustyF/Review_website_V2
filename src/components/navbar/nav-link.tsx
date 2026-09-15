import { Link } from "@/components/ui/link";
import { isNavActive } from "@/lib/nav-active";
import type { LucideIcon, NavIcon } from "@/components/navbar/nav-types";
import style from "./nav-bar.module.sass";

type NavLinkProps = {
	href: string;
	icon?: LucideIcon | NavIcon;
	// Matches CSS module class lookups' possibly-undefined typing, so callers
	// don't have to non-null-assert every style.xxx they pass.
	className: string | undefined;
	pathname: string;
	children: React.ReactNode;
	// True: label hidden at every width. False: label hides only below
	// $mobile-breakpoint (CSS-driven). Either way aria-label always covers it.
	iconOnly?: boolean;
	// Leave unset for anything dynamic/session-scoped (e.g. /account); pass
	// true only for a cheap-to-prefetch static/ISR destination.
	prefetch?: boolean;
	// Pass "_blank" for a destination that shouldn't navigate away from
	// whatever the admin already has open (e.g. the image crop tool).
	target?: string;
	// For a link that fronts a group of routes (e.g. "Media" for /movies,
	// /tv, /shorts) — active state matches any of these instead of just href.
	activeHrefs?: string[];
	// Bigger touch target for the mobile drawer's rows; every other call
	// site relies on the 14px default that matches the rest of the navbar.
	iconSize?: number;
};

// Every plain top-level nav item goes through here so the icon stays
// optional without repeating "icon && <Icon />" everywhere.
export function NavLink({
	href,
	icon: Icon,
	className,
	pathname,
	children,
	iconOnly = false,
	prefetch = false,
	target,
	activeHrefs,
	iconSize = 14,
}: NavLinkProps) {
	const isActive = (activeHrefs ?? [href]).some((h) => isNavActive(pathname, h));
	const label = typeof children === "string" ? children : undefined;
	return (
		<Link
			href={href}
			prefetch={prefetch}
			className={className}
			target={target}
			rel={target === "_blank" ? "noopener noreferrer" : undefined}
			aria-current={isActive ? "page" : undefined}
			aria-label={label}
			title={iconOnly ? label : undefined}>
			{/* Lucide ships outline-only icons, so "filled" is just a fill color. */}
			{Icon && (
				<Icon
					size={iconSize}
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
