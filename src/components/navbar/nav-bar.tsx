"use client";
import { Link } from "@/components/ui/link";
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
import { useNavbarVisibility } from "@/components/navbar/use-navbar-visibility";
import { useMobileDrawer } from "@/components/navbar/use-mobile-drawer";
import { useAvatarImage } from "@/components/navbar/use-avatar-image";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useAvatar } from "@/components/account/avatar-context";
import style from "./nav-bar.module.sass";
import { LogoImage } from "@/components/logo/logo-image";

export default function Navbar() {
	const { data: session } = useSession();
	// Fetched client-side since the session JWT only refreshes at sign-in.
	const { avatarSrc } = useAvatar();
	const isAdmin = useIsAdmin();
	const pathname = usePathname();
	const hidden = useNavbarVisibility();
	const { mobileOpen, setMobileOpen, handleNavClick } = useMobileDrawer();
	const { showAvatar, onAvatarError } = useAvatarImage(avatarSrc);
	const signedIn = Boolean(session?.user);

	return (
		// Nav icons render at 14px, where Lucide's default stroke (designed
		// for its native 24px viewBox) would look soft. absoluteStrokeWidth
		// keeps the visible stroke a fixed 1.5px regardless of icon size, set
		// once here instead of per <Icon> call site.
		<LucideProvider strokeWidth={1.5} absoluteStrokeWidth>
			<nav
				className={`${style.wrapper} ${hidden ? style.hidden : ""}`}
				// Scoped to <nav>'s own subtree, unlike --navbar-offset which page
				// content elsewhere needs as a real global.
				data-mobile-open={mobileOpen}
				onClick={handleNavClick}>
				<Link
					href="/"
					className={style.title}
					aria-label="arthur's corner home">
					<LogoImage />
				</Link>

				{/* Below $mobile-breakpoint this same container becomes the drawer,
				toggled by the hamburger button via [data-mobile-open] above. */}
				<div className={style.nav_content}>
					<div className={style.groups}>
						{/*<div className={style.nav_group}>*/}
						{/*	<NavLink*/}
						{/*		href="/"*/}
						{/*		icon={HomeIcon}*/}
						{/*		className={style.link}*/}
						{/*		pathname={pathname}>*/}
						{/*		Home*/}
						{/*	</NavLink>*/}
						{/*</div>*/}

						<div className={style.nav_group}>
							<NavDropdown
								label="Media"
								icon={MovieIcon}
								items={[
									{ href: "/movies", label: "Movies" },
									{ href: "/tv", label: "TV" },
									{ href: "/shorts", label: "Shorts" },
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
							<NavLink
								href="/activity"
								icon={ActivityIcon}
								className={style.link}
								pathname={pathname}
								// Static-ish, safe to prefetch eagerly, unlike /account below.
								iconOnly
								prefetch>
								Activity
							</NavLink>
							<NavLink
								href="/reviews"
								icon={LayoutList}
								className={style.link}
								pathname={pathname}
								iconOnly
								prefetch>
								Reviews
							</NavLink>
							<NavLink
								href="/lists"
								icon={List}
								className={style.link}
								pathname={pathname}
								iconOnly
								prefetch>
								Lists
							</NavLink>
						</div>

						{/* NavSearch's expand spends whatever room is left in .groups,
						pushing earlier groups aside via their own flex-shrink once it
						runs out. */}
						<div className={style.nav_group}>
							<NavSearch />
						</div>
					</div>

					{/* Sibling of .groups, not nested — its width would otherwise throw
					off .groups's own body-edge alignment. */}
					<div className={`${style.nav_group} ${style.nav_group_account}`}>
						<NavAccountMenu
							signedIn={signedIn}
							pathname={pathname}
							avatarSrc={avatarSrc}
							showAvatar={showAvatar}
							onAvatarError={onAvatarError}
						/>
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
