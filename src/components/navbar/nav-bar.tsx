"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
	BookOpen,
	CirclePlus,
	GamepadDirectional,
	LayoutList,
	List,
	LogIn,
	LogOut,
	LucideProvider,
	Users,
	type LucideIcon,
} from "lucide-react";
import { ActivityIcon } from "@/components/icons/activity-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { AccountIcon } from "@/components/icons/account-icon";
import { MovieIcon } from "@/components/icons/movie-icon";
import { NavSearch } from "@/components/navbar/nav-search/nav-search";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
	NavDropdown,
	closeAllNavDropdowns,
} from "@/components/navbar/nav-dropdown";
import { isNavActive } from "@/lib/nav-active";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useAvatar } from "@/components/account/avatar-context";
import style from "./nav-bar.module.sass";

// Hides the instant you scroll down (past a small top-of-page exemption —
// otherwise the tiniest scroll right at the top would hide it pointlessly),
// but only reappears once you've scrolled back up by at least this many
// px — without a threshold, a single mouse-wheel tick or trackpad overshoot
// mid-downward-scroll would flicker it back in.
const TOP_EXEMPT_PX = 200;
const REVEAL_THRESHOLD_PX = 200;

// Widened past lucide's own LucideIcon type so the local icon components
// (HomeIcon, WatchlistIcon, AccountIcon) — which only accept the size/
// className/fill subset NavLink actually passes — satisfy it too.
type NavIcon = React.ComponentType<{
	size?: number | undefined;
	className?: string | undefined;
	fill?: string | undefined;
}>;

type NavLinkProps = {
	href: string;
	icon?: LucideIcon | NavIcon;
	// CSS module class lookups are typed as possibly-undefined (an unknown
	// key would silently produce `undefined`), so this matches that rather
	// than requiring callers to non-null-assert every style.xxx they pass.
	className: string | undefined;
	pathname: string;
	children: React.ReactNode;
	// Code-level opt-in (as opposed to the viewport-driven collapse every
	// other label already goes through — see collapseTier below) — the
	// label stays out of the DOM at every width rather than just visually
	// hidden, with `children` moved to aria-label/title so the link's name
	// is still exposed to screen readers and as a hover tooltip.
	iconOnly?: boolean;
	// Which staggered collapse breakpoint this link's label hides at — see
	// COLLAPSE_TIER below for how tiers are assigned per nav_group. Ignored
	// when iconOnly is set (there's no label to collapse).
	collapseTier?: number;
};

// Tier assignment per nav_group, right to left — tier 1 is the widest
// breakpoint (collapses first, as the viewport starts narrowing), tier 4 the
// narrowest (collapses last). Keeps labels disappearing one group at a time
// instead of every link's text vanishing together at one shared breakpoint.
// Watchlist/Account are iconOnly already (no label to collapse at all), so
// only the sign-out/sign-in label actually uses ACCOUNT here.
const COLLAPSE_TIER = {
	ACCOUNT: 1,
	ACTIVITY: 2,
	BROWSE: 3,
	HOME: 4,
} as const;

// Every plain top-level item (as opposed to a NavDropdown) goes through
// here so an icon stays optional without repeating the same "icon &&
// <Icon />" line at every one of these call sites.
function NavLink({
	href,
	icon: Icon,
	className,
	pathname,
	children,
	iconOnly = false,
	collapseTier = 4,
}: NavLinkProps) {
	const isActive = isNavActive(pathname, href);
	const label = typeof children === "string" ? children : undefined;
	return (
		<Link
			href={href}
			className={className}
			aria-current={isActive ? "page" : undefined}
			aria-label={iconOnly ? label : undefined}
			title={iconOnly ? label : undefined}>
			{/* Lucide ships outline-only icons — no separate filled set — so
			"filled" here is just handing the same icon a fill color instead
			of "none" on top of its existing stroke. */}
			{Icon && (
				<Icon
					size={14}
					className={style.nav_icon}
					// fill={isActive ? "currentColor" : "none"}
				/>
			)}
			{/* Collapses away below $navbar-collapse-width (see nav-bar.module
			.sass's .link_label), leaving just the icon above — every NavLink
			call site is given an icon for exactly this reason, so nothing
			disappears entirely at narrow widths. Skipped entirely for
			iconOnly links instead of just hidden, so their aria-label above
			is the link's only accessible name rather than a redundant one. */}
			{!iconOnly && (
				<span className={style[`link_label_tier${collapseTier}`]}>
					{children}
				</span>
			)}
		</Link>
	);
}

export default function Navbar() {
	const { data: session } = useSession();
	// Fetched client-side (see avatar-context.tsx) rather than off the
	// session, which only refreshes at sign-in — `session?.user` below is
	// still what decides whether the Account link (vs "Sign in") shows at
	// all, that part's fine coming from the JWT.
	const { avatarSrc } = useAvatar();
	const isAdmin = useIsAdmin();
	const pathname = usePathname();
	const [hidden, setHidden] = useState(false);
	// A saved avatar src that 404s (stale — see avatar-picker.tsx's own
	// version of this) would otherwise render as a blank broken <img> instead
	// of falling back to AccountIcon. Reset whenever avatarSrc itself changes
	// — the React-recommended "adjust state during render" pattern rather
	// than a useEffect, since this is deriving state from a prop change, not
	// synchronizing with an external system.
	const [avatarFailed, setAvatarFailed] = useState(false);
	const [lastAvatarSrc, setLastAvatarSrc] = useState(avatarSrc);
	if (avatarSrc !== lastAvatarSrc) {
		setLastAvatarSrc(avatarSrc);
		setAvatarFailed(false);
	}
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

	// Mirrors `hidden` onto <html> as a class rather than only this
	// component's own .hidden — lets globals.sass expose a --navbar-offset
	// custom property that any sticky element elsewhere on the page (e.g.
	// GroupedMediaGrid/GroupedMediaList's .group_header) can position itself
	// against, instead of guessing a fixed offset that's only ever right in
	// one of the navbar's two states. See globals.sass's own --navbar-offset
	// comment for the other half of this.
	useEffect(() => {
		document.documentElement.classList.toggle("nav-hidden", hidden);
		return () => document.documentElement.classList.remove("nav-hidden");
	}, [hidden]);

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
		// Every nav icon (here and in NavDropdown, which sits inside this
		// tree) is rendered at a small size (14px) against Lucide's native
		// 24px-viewBox design, which scales the default 2px stroke down to a
		// non-integer ~1.17px — soft/anti-aliased rather than crisp at that
		// size. absoluteStrokeWidth makes `strokeWidth` a real, fixed pixel
		// width regardless of icon size (it inflates the pre-scale stroke by
		// 24/size so the post-scale result comes out exactly 1.5px), instead
		// of guessing a size that happens to divide 24 evenly. One provider
		// here beats passing the same two props at every individual <Icon>
		// call site (NavLink's own icon, NavDropdown's trigger and panel
		// items, the chevron).
		<LucideProvider strokeWidth={1.5} absoluteStrokeWidth>
			<nav
				className={`${style.wrapper} ${hidden ? style.hidden : ""}`}
				onClick={handleNavClick}>
				{/* Both the search box and every nav link cluster live inside this
				one absolutely-positioned container (see .nav_content's own
				comment in nav-bar.module.sass) so the links flow immediately
				after the search box wherever it ends up sitting, rather than
				the two being positioned independently of each other. */}
				<div className={style.nav_content}>
					<div className={style.search}>
						<NavSearch />
					</div>

					<div className={style.groups}>
						<div className={style.nav_group}>
							<NavLink
								href="/"
								icon={HomeIcon}
								className={style.link}
								pathname={pathname}
								collapseTier={COLLAPSE_TIER.HOME}>
								Home
							</NavLink>
						</div>

						<div className={style.nav_group}>
							<NavDropdown
								label="Media"
								icon={MovieIcon}
								collapseTier={COLLAPSE_TIER.BROWSE}
								items={[
									{ href: "/movies", label: "Movies" },
									{ href: "/shorts", label: "Shorts" },
									{ href: "/tv", label: "TV" },
								]}
							/>
							<NavDropdown
								label="Reading"
								icon={BookOpen}
								collapseTier={COLLAPSE_TIER.BROWSE}
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
								pathname={pathname}
								collapseTier={COLLAPSE_TIER.BROWSE}>
								Games
							</NavLink>
						</div>

						<div className={style.nav_group}>
							<NavLink
								href="/activity"
								icon={ActivityIcon}
								className={style.link}
								pathname={pathname}
								collapseTier={COLLAPSE_TIER.ACTIVITY}>
								Activity
							</NavLink>
							<NavLink
								href="/reviews"
								icon={LayoutList}
								className={style.link}
								pathname={pathname}
								collapseTier={COLLAPSE_TIER.ACTIVITY}>
								Reviews
							</NavLink>
							<NavLink
								href="/lists"
								icon={List}
								className={style.link}
								pathname={pathname}
								collapseTier={COLLAPSE_TIER.ACTIVITY}>
								Lists
							</NavLink>
						</div>

						<div className={`${style.nav_group} ${style.nav_group_end}`}>
							{session?.user ? (
								<>
									<NotificationBell />
									<Link
										href="/account"
										className={style.link}
										aria-current={
											isNavActive(pathname, "/account") ? "page" : undefined
										}
										aria-label="Account"
										title="Account">
										{avatarSrc && !avatarFailed ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={avatarSrc}
												alt=""
												className={style.nav_avatar}
												onError={() => setAvatarFailed(true)}
											/>
										) : (
											<AccountIcon size={14} className={style.nav_icon} />
										)}
									</Link>
									<button
										type="button"
										className={style.sign_out_button}
										onClick={() => signOut({ callbackUrl: "/" })}>
										<LogOut size={14} className={style.nav_icon} />
										<span
											className={
												style[`link_label_tier${COLLAPSE_TIER.ACCOUNT}`]
											}>
											Sign out
										</span>
									</button>
								</>
							) : (
								<NavLink
									href="/login"
									icon={LogIn}
									className={style.sign_out_button}
									pathname={pathname}
									collapseTier={COLLAPSE_TIER.ACCOUNT}>
									Sign in
								</NavLink>
							)}
						</div>
					</div>
				</div>

				{/* Detached from the .nav_group flex flow and pinned to its own
				    corner instead — still a child of <nav> (not a separate fixed
				    element), so it still hides/reveals in step with the rest of
				    the navbar on scroll. */}
				{isAdmin && (
					<div className={style.add_media_link}>
						<NavLink
							href="/add"
							icon={CirclePlus}
							className={style.link}
							pathname={pathname}>
							Add media
						</NavLink>
						<NavLink
							href="/admin/user-lists"
							icon={Users}
							className={style.link}
							pathname={pathname}>
							User lists
						</NavLink>
					</div>
				)}
			</nav>
		</LucideProvider>
	);
}
