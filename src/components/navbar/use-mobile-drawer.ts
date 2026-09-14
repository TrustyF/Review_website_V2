"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";

// Tracks the mobile drawer's open state via a data-mobile-open attribute scoped to
// <nav>, not a class on <html>, since nothing outside <nav> needs to react to it.
export function useMobileDrawer() {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);
	// Closes on any route change (e.g. back/forward), adjusted during render
	// rather than in an effect, which would leave it open one render too long.
	const [lastPathname, setLastPathname] = useState(pathname);
	if (pathname !== lastPathname) {
		setLastPathname(pathname);
		setMobileOpen(false);
	}

	// Delegated so no NavLink needs to know about drawer state. Only "a"
	// matches — the hamburger's a Clickable (role=button div), not an anchor,
	// so its own click never closes what it just opened.
	function handleNavClick(e: React.MouseEvent<HTMLElement>) {
		if ((e.target as HTMLElement).closest("a")) {
			setMobileOpen(false);
		}
	}

	return { mobileOpen, setMobileOpen, handleNavClick };
}
