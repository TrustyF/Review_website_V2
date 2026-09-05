// Home exact-match; others prefix-match so sub-routes highlight their section.
export function isNavActive(pathname: string, href: string): boolean {
	if (href === "/") return pathname === "/";
	return pathname === href || pathname.startsWith(`${href}/`);
}
