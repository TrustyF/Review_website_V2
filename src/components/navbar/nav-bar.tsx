"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
	BookOpen,
	GamepadDirectional,
	LayoutList,
	List,
	LucideProvider,
} from "lucide-react";
import { ActivityIcon } from "@/components/icons/activity-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { MovieIcon } from "@/components/icons/movie-icon";
import { LogoTag } from "@/components/logo/logo-tag";
import { NavSearch } from "@/components/navbar/nav-search/nav-search";
import { NavDropdown } from "@/components/navbar/nav-dropdown";
import { NavLink } from "@/components/navbar/nav-link";
import { NavAccountMenu } from "@/components/navbar/nav-account-menu";
import { NavMobileControls } from "@/components/navbar/nav-mobile-controls";
import { NavAdminLinks } from "@/components/navbar/nav-admin-links";
import { COLLAPSE_TIER } from "@/components/navbar/nav-constants";
import { useNavbarVisibility } from "@/components/navbar/use-navbar-visibility";
import { useMobileDrawer } from "@/components/navbar/use-mobile-drawer";
import { useAvatarImage } from "@/components/navbar/use-avatar-image";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useAvatar } from "@/components/account/avatar-context";
import style from "./nav-bar.module.sass";

export default function Navbar() {
	const { data: session } = useSession();
	// Fetched client-side (see avatar-context.tsx) rather than off the
	// session, which only refreshes at sign-in — `session?.user` below is
	// still what decides whether the Account link (vs "Sign in") shows at
	// all, that part's fine coming from the JWT.
	const { avatarSrc } = useAvatar();
	const isAdmin = useIsAdmin();
	const pathname = usePathname();
	const hidden = useNavbarVisibility();
	const { mobileOpen, setMobileOpen, handleNavClick } = useMobileDrawer();
	const { showAvatar, onAvatarError } = useAvatarImage(avatarSrc);
	const signedIn = Boolean(session?.user);

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
				// Scopes the mobile drawer's open state to this element's own
				// subtree (see nav-bar.module.sass/nav-dropdown.module.sass's
				// [data-mobile-open] rules and useMobileDrawer's own comment) —
				// nothing outside <nav> needs to read this, unlike --navbar-offset
				// (useNavbarVisibility), which page content elsewhere genuinely
				// does need and so stays a real global.
				data-mobile-open={mobileOpen}
				onClick={handleNavClick}>
				<Link
					href="/"
					className={style.title}
					aria-label="arthur's corner home">
					<LogoTag />
				</Link>

				{/* Both the search box and every nav link cluster live inside this
				one absolutely-positioned container (see .nav_content's own
				comment in nav-bar.module.sass) so the links flow immediately
				after the search box wherever it ends up sitting, rather than
				the two being positioned independently of each other. Below
				$mobile-breakpoint this same container becomes the drawer the
				hamburger button (below) toggles, via [data-mobile-open] above. */}
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
							<NavAccountMenu
								signedIn={signedIn}
								pathname={pathname}
								avatarSrc={avatarSrc}
								showAvatar={showAvatar}
								onAvatarError={onAvatarError}
							/>
						</div>
					</div>
				</div>

				<NavMobileControls
					signedIn={signedIn}
					pathname={pathname}
					avatarSrc={avatarSrc}
					showAvatar={showAvatar}
					onAvatarError={onAvatarError}
					mobileOpen={mobileOpen}
					onToggle={() => setMobileOpen((open) => !open)}
				/>

				{isAdmin && <NavAdminLinks pathname={pathname} />}
			</nav>
		</LucideProvider>
	);
}
