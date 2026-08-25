"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { closeAllNavDropdowns } from "@/components/navbar/nav-dropdown";

// Tracks the mobile drawer's open state. Scoped entirely to the navbar's own
// DOM subtree via a data-mobile-open attribute on <nav> (see nav-bar.tsx and
// nav-bar.module.sass/nav-dropdown.module.sass's own [data-mobile-open]
// rules) rather than a class mirrored onto <html> — nothing outside <nav>
// needs to react to this, unlike --navbar-offset (useNavbarVisibility).
export function useMobileDrawer() {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);
	// A route change is always the drawer's cue to close, whether or not it
	// went through handleNavClick below (e.g. browser back/forward) —
	// adjusted during render (the React-sanctioned alternative to a
	// setState-in-effect) rather than an effect, which would otherwise leave
	// the drawer open through one extra render of the new page before
	// catching up.
	const [lastPathname, setLastPathname] = useState(pathname);
	if (pathname !== lastPathname) {
		setLastPathname(pathname);
		setMobileOpen(false);
	}

	// Delegated rather than one handler per Link — this catches both a
	// dropdown item picking its own page (the panel should close behind it)
	// and a plain top-level link being clicked while an unrelated dropdown
	// happens to still be open. Keyed off "a, button" so it skips a
	// dropdown's own <summary> trigger (neither tag), which already has its
	// own open/close handling.
	function handleNavClick(e: React.MouseEvent<HTMLElement>) {
		const clicked = (e.target as HTMLElement).closest("a, button");
		if (!clicked) return;
		closeAllNavDropdowns();
		// The hamburger button itself already toggles mobileOpen in its own
		// onClick, which fires before this delegated handler sees the same
		// (bubbled) click — closing it here unconditionally would immediately
		// undo that toggle.
		if (!clicked.hasAttribute("data-mobile-toggle")) {
			setMobileOpen(false);
		}
	}

	return { mobileOpen, setMobileOpen, handleNavClick };
}
