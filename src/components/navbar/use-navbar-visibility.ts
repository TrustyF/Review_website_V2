"use client";
import { useEffect, useRef, useState } from "react";

// Hides the instant you scroll down (past a small top-of-page exemption —
// otherwise the tiniest scroll right at the top would hide it pointlessly),
// but only reappears once you've scrolled back up by at least this many
// px — without a threshold, a single mouse-wheel tick or trackpad overshoot
// mid-downward-scroll would flicker it back in.
const TOP_EXEMPT_PX = 100;
const REVEAL_THRESHOLD_PX = 100;

// Tracks the navbar's scroll-driven show/hide state and mirrors the result
// onto --navbar-offset (globals.sass) directly, rather than toggling a class
// on <html> for globals.sass to translate into the same variable — the
// variable's the only thing anything outside the navbar actually needs (a
// sticky element elsewhere on the page, e.g. GroupedMediaGrid/
// GroupedMediaList's own .group_header, positions itself against it so it
// sits right below the navbar instead of either colliding with it or
// leaving a permanent gap once the navbar's hidden itself away), so this
// sets it in one place instead of splitting the logic across a JS class
// toggle and a CSS rule that reacts to it.
export function useNavbarVisibility() {
	const [hidden, setHidden] = useState(false);
	// Refs, not state — every scroll frame writes these, and re-rendering on
	// each one (rather than only when `hidden` actually flips) would be pure
	// waste.
	const lastScrollY = useRef(0);
	const scrolledUpBy = useRef(0);

	useEffect(() => {
		lastScrollY.current = window.scrollY;

		function handleScroll() {
			const currentY = window.scrollY;
			const delta = currentY - lastScrollY.current;

			if (delta > 0) {
				// Scrolling down — resets the up-streak so a following up-scroll
				// has to earn the reveal threshold again from scratch, rather
				// than carrying over progress from before the direction changed.
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
	}, []);

	useEffect(() => {
		document.documentElement.style.setProperty(
			"--navbar-offset",
			hidden ? "0rem" : "var(--navbar-height)",
		);
		return () => {
			document.documentElement.style.removeProperty("--navbar-offset");
		};
	}, [hidden]);

	return hidden;
}
