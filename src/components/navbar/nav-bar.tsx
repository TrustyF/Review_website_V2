"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
	BookOpen,
	Clapperboard,
	GamepadDirectional,
	type LucideIcon,
} from "lucide-react";
import { NavSearch } from "@/components/navbar/nav-search/nav-search";
import {
	NavDropdown,
	closeAllNavDropdowns,
} from "@/components/navbar/nav-dropdown";
import { isNavActive } from "@/lib/nav-active";
import { useIsAdmin } from "@/lib/use-is-admin";
import style from "./nav-bar.module.sass";

// Hides the instant you scroll down (past a small top-of-page exemption —
// otherwise the tiniest scroll right at the top would hide it pointlessly),
// but only reappears once you've scrolled back up by at least this many
// px — without a threshold, a single mouse-wheel tick or trackpad overshoot
// mid-downward-scroll would flicker it back in.
const TOP_EXEMPT_PX = 200;
const REVEAL_THRESHOLD_PX = 200;

type NavLinkProps = {
	href: string;
	icon?: LucideIcon;
	// CSS module class lookups are typed as possibly-undefined (an unknown
	// key would silently produce `undefined`), so this matches that rather
	// than requiring callers to non-null-assert every style.xxx they pass.
	className: string | undefined;
	pathname: string;
	children: React.ReactNode;
};

// Every plain top-level item (as opposed to a NavDropdown) goes through
// here so an icon stays optional without repeating the same "icon &&
// <Icon />" line at every one of these call sites.
function NavLink({
	href,
	icon: Icon,
	className,
	pathname,
	children,
}: NavLinkProps) {
	const isActive = isNavActive(pathname, href);
	return (
		<Link
			href={href}
			className={className}
			aria-current={isActive ? "page" : undefined}>
			{/* Lucide ships outline-only icons — no separate filled set — so
			"filled" here is just handing the same icon a fill color instead
			of "none" on top of its existing stroke. */}
			{Icon && <Icon size={14} fill={isActive ? "currentColor" : "none"} />}
			{children}
		</Link>
	);
}

export default function Navbar() {
	const { data: session } = useSession();
	const isAdmin = useIsAdmin();
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

	// Delegated rather than one handler per Link — this catches both a
	// dropdown item picking its own page (the panel should close behind it)
	// and a plain top-level link being clicked while an unrelated dropdown
	// happens to still be open. Keyed off "a, button" so it skips a
	// dropdown's own <summary> trigger (neither tag), which already has its
	// own open/close handling.
	function handleNavClick(e: React.MouseEvent<HTMLElement>) {
		if ((e.target as HTMLElement).closest("a, button")) {
			closeAllNavDropdowns();
		}
	}

	return (
		<nav
			className={`${style.wrapper} ${hidden ? style.hidden : ""}`}
			onClick={handleNavClick}>
			<Link href="/" className={style.title}>
				Arthur&#39;s Corner
			</Link>

			<div className={style.search}>
				<NavSearch />
			</div>

			<div className={style.nav_group}>
				<NavLink href="/" className={style.link} pathname={pathname}>
					Home
				</NavLink>
			</div>

			<div className={style.nav_group}>
				<NavDropdown
					label="Media"
					icon={Clapperboard}
					items={[
						{ href: "/movies", label: "Movies" },
						{ href: "/shorts", label: "Shorts" },
						{ href: "/tv", label: "TV" },
					]}
				/>
				<NavDropdown
					label="Reading"
					icon={BookOpen}
					items={[
						{ href: "/manga", label: "Manga" },
						{ href: "/comics", label: "Comics" },
						{ href: "/books", label: "Books" },
					]}
				/>
				<NavLink
					href="/games"
					icon={GamepadDirectional}
					className={style.link}
					pathname={pathname}>
					Games
				</NavLink>
			</div>

			<div className={style.nav_group}>
				<NavLink href="/lists" className={style.link} pathname={pathname}>
					Lists
				</NavLink>
				{isAdmin && (
					<NavLink href="/add" className={style.link} pathname={pathname}>
						Add media
					</NavLink>
				)}
			</div>

			<div className={style.nav_group}>
				{session?.user ? (
					<>
						<NavLink
							href="/watchlist"
							className={style.link}
							pathname={pathname}>
							Watchlist
						</NavLink>
						<NavLink href="/account" className={style.link} pathname={pathname}>
							Account
						</NavLink>
						<button
							type="button"
							className={style.sign_out_button}
							onClick={() => signOut({ callbackUrl: "/" })}>
							Sign out
						</button>
					</>
				) : (
					<NavLink
						href="/login"
						className={style.sign_out_button}
						pathname={pathname}>
						Sign in
					</NavLink>
				)}
			</div>
		</nav>
	);
}
