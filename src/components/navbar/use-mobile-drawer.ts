"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useOutsideClick } from "@/lib/use-outside-click";

// Tracks the mobile drawer's open state via a data-mobile-open attribute scoped to
// <nav>, not a class on <html>, since nothing outside <nav> needs to react to it.
export function useMobileDrawer() {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);
	const navRef = useRef<HTMLElement>(null);
	// Closes on any route change (e.g. back/forward), adjusted during render
	// rather than in an effect, which would leave it open one render too long.
	const [lastPathname, setLastPathname] = useState(pathname);
	if (pathname !== lastPathname) {
		setLastPathname(pathname);
		setMobileOpen(false);
	}

	// The dropdown no longer covers the screen, so a tap elsewhere on the
	// page — not just a nav link — should dismiss it too.
	useOutsideClick(navRef, () => setMobileOpen(false), { enabled: mobileOpen });

	// Locks the background page's scroll while the drawer's open — otherwise
	// the page scrolls .wrapper's own fixed anchor out from under it. Body
	// has min-height not height, so <html> is the real scroller — both need it.
	useEffect(() => {
		if (!mobileOpen) return;
		const html = document.documentElement;
		const previousHtmlOverflow = html.style.overflow;
		const previousBodyOverflow = document.body.style.overflow;
		html.style.overflow = "hidden";
		document.body.style.overflow = "hidden";
		return () => {
			html.style.overflow = previousHtmlOverflow;
			document.body.style.overflow = previousBodyOverflow;
		};
	}, [mobileOpen]);

	// Delegated so no NavLink needs to know about drawer state. Only "a"
	// matches — the hamburger's a Clickable (role=button div), not an anchor,
	// so its own click never closes what it just opened.
	function handleNavClick(e: React.MouseEvent<HTMLElement>) {
		if ((e.target as HTMLElement).closest("a")) {
			setMobileOpen(false);
		}
	}

	return { mobileOpen, setMobileOpen, handleNavClick, navRef };
}
