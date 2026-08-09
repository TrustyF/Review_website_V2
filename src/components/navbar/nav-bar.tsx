"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NavSearch } from "@/components/navbar/nav-search/nav-search";
import style from "./nav-bar.module.sass";

// Hides the instant you scroll down (past a small top-of-page exemption —
// otherwise the tiniest scroll right at the top would hide it pointlessly),
// but only reappears once you've scrolled back up by at least this many
// px — without a threshold, a single mouse-wheel tick or trackpad overshoot
// mid-downward-scroll would flicker it back in.
const TOP_EXEMPT_PX = 200;
const REVEAL_THRESHOLD_PX = 200;

export default function Navbar() {
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

	return (
		<nav className={`${style.wrapper} ${hidden ? style.hidden : ""}`}>
			<Link href="/" className={style.title}>
				Review app
			</Link>

			<NavSearch />

			<Link href="/" className={style.link}>
				Home
			</Link>
			<Link href="/movies" className={style.link}>
				Movies
			</Link>
			<Link href="/shorts" className={style.link}>
				Shorts
			</Link>
			<Link href="/tv" className={style.link}>
				TV
			</Link>
			<Link href="/manga" className={style.link}>
				Manga
			</Link>
			<Link href="/games" className={style.link}>
				Games
			</Link>
			<Link href="/comics" className={style.link}>
				Comics
			</Link>
			<Link href="/lists" className={style.link}>
				Lists
			</Link>
			<Link href="/add" className={style.link}>
				Add
			</Link>
		</nav>
	);
}
