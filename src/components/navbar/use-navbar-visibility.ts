"use client";
import { useEffect, useRef, useState } from "react";

// Hides on scroll-down (past a top-of-page exemption), reappears only after
// scrolling back up past a threshold, so a single wheel tick doesn't flicker it.
const TOP_EXEMPT_PX = 100;
const REVEAL_THRESHOLD_PX = 100;

// Matches $mobile-breakpoint (variables.sass). Own listener rather than the
// shared useIsMobileViewport store, whose breakpoint is tuned independently
// for admin-editing gates elsewhere, not the navbar.
const MOBILE_BREAKPOINT_PX = 830;
const DESKTOP_NAV_QUERY = `(min-width: ${MOBILE_BREAKPOINT_PX + 1}px)`;

// True at/above $mobile-breakpoint, where the navbar is fixed and hideable.
// Below it the navbar is position: relative (nav-bar.module.sass) — nothing
// to hide/reveal, so callers skip that logic entirely.
function useIsDesktopNav() {
	// Lazy initializer reads the real value on the client immediately (no SSR
	// window, so it falls back to false there — irrelevant since this never
	// feeds into rendered JSX, only into effects below).
	const [isDesktopNav, setIsDesktopNav] = useState(
		() => typeof window !== "undefined" && window.matchMedia(DESKTOP_NAV_QUERY).matches,
	);

	useEffect(() => {
		const mql = window.matchMedia(DESKTOP_NAV_QUERY);
		const handleChange = () => setIsDesktopNav(mql.matches);
		mql.addEventListener("change", handleChange);
		return () => mql.removeEventListener("change", handleChange);
	}, []);

	return isDesktopNav;
}

// Mirrors show/hide onto --navbar-offset rather than a CSS-translated class —
// other elements (e.g. sticky group headers) position against that variable.
export function useNavbarVisibility() {
	const isDesktopNav = useIsDesktopNav();
	const [hidden, setHidden] = useState(false);
	// Refs, not state — every scroll frame writes these; re-rendering on each
	// one would be wasted.
	const lastScrollY = useRef(0);
	const scrolledUpBy = useRef(0);

	useEffect(() => {
		if (!isDesktopNav) return;

		lastScrollY.current = window.scrollY;

		function handleScroll() {
			const currentY = window.scrollY;
			const delta = currentY - lastScrollY.current;

			if (delta > 0) {
				// Scrolling down resets the up-streak so a following up-scroll has to
				// earn the reveal threshold again from scratch.
				scrolledUpBy.current = 0;
				if (currentY > TOP_EXEMPT_PX) setHidden(true);
			} else if (delta < 0) {
				scrolledUpBy.current += -delta;
				if (
					scrolledUpBy.current > REVEAL_THRESHOLD_PX ||
					currentY <= TOP_EXEMPT_PX
				) {
					setHidden(false);
				}
			}

			lastScrollY.current = currentY;
		}

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, [isDesktopNav]);

	useEffect(() => {
		// globals.sass pins --navbar-offset to 0rem itself below the breakpoint.
		if (!isDesktopNav) return;

		document.documentElement.style.setProperty(
			"--navbar-offset",
			hidden ? "0rem" : "var(--navbar-height)",
		);
		return () => {
			document.documentElement.style.removeProperty("--navbar-offset");
		};
	}, [hidden, isDesktopNav]);

	// Forced false below the breakpoint regardless of stale scroll-derived
	// state, rather than resetting it via an extra effect.
	return isDesktopNav && hidden;
}
