// Shared by nav-bar.tsx and nav-dropdown.tsx to avoid duplicated logic.
// Home ("/") only matches exactly; everything else matches by prefix so
// sub-routes (e.g. /lists/[id]) still highlight their section's link.
export function isNavActive(pathname: string, href: string): boolean {
	if (href === "/") return pathname === "/";
	return pathname === href || pathname.startsWith(`${href}/`);
}
