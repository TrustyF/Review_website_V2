"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
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
	const { data: session } = useSession();
	const pathname = usePathname();
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

	// Home ("/") only counts as active on an exact match — every other route
	// starts with "/" too. Everything else matches on prefix, so a sub-route
	// (e.g. /lists/[id]) still highlights its section's link.
	function isActive(href: string) {
		if (href === "/") return pathname === "/";
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	function current(href: string) {
		return isActive(href) ? "page" : undefined;
	}

	return (
		<nav className={`${style.wrapper} ${hidden ? style.hidden : ""}`}>
			<Link href="/" className={style.title}>
				Arthur&#39;s Corner
			</Link>

			<NavSearch />

			<Link href="/" className={style.link} aria-current={current("/")}>
				Home
			</Link>
			<Link
				href="/movies"
				className={style.link}
				aria-current={current("/movies")}>
				Movies
			</Link>
			<Link
				href="/shorts"
				className={style.link}
				aria-current={current("/shorts")}>
				Shorts
			</Link>
			<Link href="/tv" className={style.link} aria-current={current("/tv")}>
				TV
			</Link>
			<Link
				href="/manga"
				className={style.link}
				aria-current={current("/manga")}>
				Manga
			</Link>
			<Link
				href="/games"
				className={style.link}
				aria-current={current("/games")}>
				Games
			</Link>
			<Link
				href="/comics"
				className={style.link}
				aria-current={current("/comics")}>
				Comics
			</Link>
			<Link
				href="/books"
				className={style.link}
				aria-current={current("/books")}>
				Books
			</Link>
			<Link
				href="/lists"
				className={style.link}
				aria-current={current("/lists")}>
				Lists
			</Link>
			<Link href="/add" className={style.link} aria-current={current("/add")}>
				Add
			</Link>
			{session?.user ? (
				<>
					<Link
						href="/watchlist"
						className={style.link}
						aria-current={current("/watchlist")}>
						Watchlist
					</Link>
					<Link
						href="/account"
						className={style.link}
						aria-current={current("/account")}>
						Account
					</Link>
					<button
						type="button"
						className={style.sign_out_button}
						onClick={() => signOut({ callbackUrl: "/" })}>
						Sign out
					</button>
				</>
			) : (
				<Link
					href="/login"
					className={style.sign_out_button}
					aria-current={current("/login")}>
					Sign in
				</Link>
			)}
		</nav>
	);
}
