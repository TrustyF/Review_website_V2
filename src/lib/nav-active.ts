// Shared by nav-bar.tsx's plain links and nav-dropdown.tsx's grouped ones —
// duplicating this into both used to be the plan, but that's exactly the
// kind of copy that quietly drifts (see nav-bar.module.sass's .sign_out_button
// history). Home ("/") only counts as active on an exact match — every
// other route starts with "/" too. Everything else matches on prefix, so a
// sub-route (e.g. /lists/[id]) still highlights its section's link.
export function isNavActive(pathname: string, href: string): boolean {
	if (href === "/") return pathname === "/";
	return pathname === href || pathname.startsWith(`${href}/`);
}
