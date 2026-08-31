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
	// Label hidden on desktop, moved to aria-label/title; stays a real DOM
	// element (not omitted) so the mobile drawer can bring it back.
	iconOnly?: boolean;
	// Leave unset for anything dynamic/session-scoped (e.g. /account); pass
	// true only for a cheap-to-prefetch static/ISR destination.
	prefetch?: boolean;
};

// Every plain top-level item (vs. a NavDropdown) goes through here so the
// icon stays optional without repeating "icon && <Icon />" everywhere.
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
			{/* Lucide ships outline-only icons, so "filled" is just a fill color. */}
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
