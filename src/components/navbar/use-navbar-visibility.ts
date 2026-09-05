"use client";
import { useEffect, useRef, useState } from "react";

// Hides on scroll-down (past a top-of-page exemption), reappears only after
// scrolling back up past a threshold, so a single wheel tick doesn't flicker it.
const TOP_EXEMPT_PX = 100;
const REVEAL_THRESHOLD_PX = 100;

// Mirrors show/hide onto --navbar-offset rather than a CSS-translated class —
// other elements (e.g. sticky group headers) position against that variable.
export function useNavbarVisibility() {
	const [hidden, setHidden] = useState(false);
	// Refs, not state — every scroll frame writes these; re-rendering on each
	// one would be wasted.
	const lastScrollY = useRef(0);
	const scrolledUpBy = useRef(0);

	useEffect(() => {
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
