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

	// Delegated so it catches any link/button click, not just handleNavClick per Link.
	function handleNavClick(e: React.MouseEvent<HTMLElement>) {
		const clicked = (e.target as HTMLElement).closest("a, button");
		if (!clicked) return;
		// The hamburger's own onClick already toggled mobileOpen before this
		// bubbled click arrives — closing it here would undo that toggle.
		if (!clicked.hasAttribute("data-mobile-toggle")) {
			setMobileOpen(false);
		}
	}

	return { mobileOpen, setMobileOpen, handleNavClick };
}
