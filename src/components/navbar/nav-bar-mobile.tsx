"use client";
import {
	BookOpen,
	GamepadDirectional,
	LayoutList,
	List,
	Menu,
	X,
} from "lucide-react";
import { ActivityIcon } from "@/components/icons/activity-icon";
import { MovieIcon } from "@/components/icons/movie-icon";
import { Clickable } from "@/components/ui/clickable";
import { NavSearch } from "@/components/navbar/nav-search/nav-search";
import { NavLink } from "@/components/navbar/nav-link";
import { NavAccountMenu } from "@/components/navbar/nav-account-menu";
import { SignOutButton } from "@/components/account/sign-out-button/sign-out-button";
import { useDictionary } from "@/lib/i18n/i18n-context";
import barStyle from "./nav-bar.module.sass";
import style from "./nav-bar-mobile.module.sass";

type Props = {
	signedIn: boolean;
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
	mobileOpen: boolean;
	onToggle: () => void;
};

// Collapsed bar (Media/Reading/Games + search + hamburger, closed; account +
// hamburger, open) below $mobile-breakpoint, plus the drawer the hamburger
// opens for the rest. NavBarLinks covers desktop.
export function NavBarMobile({
	signedIn,
	pathname,
	avatarSrc,
	showAvatar,
	onAvatarError,
	mobileOpen,
	onToggle,
}: Props) {
	const dict = useDictionary();

	return (
		<>
			<div className={style.bar_end}>
				{/* data-quick-links marks this so nav-bar.module.sass brings the
				labels back at/above 500px. */}
				<div className={style.quick_links} data-quick-links>
					<NavLink
						href="/movies"
						activeHrefs={["/movies", "/tv", "/shorts"]}
						icon={MovieIcon}
						className={barStyle.link}
						pathname={pathname}
						iconOnly>
						{dict.nav.media}
					</NavLink>
					<NavLink
						href="/manga"
						activeHrefs={["/manga", "/comics", "/books"]}
						icon={BookOpen}
						className={barStyle.link}
						pathname={pathname}
						iconOnly>
						{dict.nav.reading}
					</NavLink>
					<NavLink
						href="/games"
						icon={GamepadDirectional}
						className={barStyle.link}
						pathname={pathname}
						iconOnly>
						{dict.nav.games}
					</NavLink>
				</div>
				<NavSearch />
			</div>

			{/* Sibling of .bar_end, not nested in it — both position: absolute
			against .wrapper independently (nav-bar-mobile.module.sass), so
			neither's flow depends on the other. */}
			<Clickable
				className={style.toggle}
				aria-label={mobileOpen ? dict.nav.closeMenu : dict.nav.openMenu}
				aria-pressed={mobileOpen}
				onClick={onToggle}>
				<span className={style.toggle_icons}>
					<Menu
						size={20}
						className={`${style.toggle_icon} ${mobileOpen ? style.toggle_icon_hidden : ""}`}
					/>
					<X
						size={20}
						className={`${style.toggle_icon} ${mobileOpen ? "" : style.toggle_icon_hidden}`}
					/>
				</span>
			</Clickable>

			{/* data-nav-drawer reveals iconOnly items' labels (nav-bar.module.sass).
			iconSize bumps them past the navbar's usual 14px for a touch menu. */}
			<div className={style.drawer} data-nav-drawer>
				{/* In the drawer's own flow — its own padding, independent of
				.wrapper's (nav-bar.module.sass), not pinned to the bar above.
				data-account-bar sizes up the avatar image there. */}
				<div className={style.account_bar} data-account-bar>
					<NavAccountMenu
						signedIn={signedIn}
						pathname={pathname}
						avatarSrc={avatarSrc}
						showAvatar={showAvatar}
						onAvatarError={onAvatarError}
						avatarIconSize={32}
					/>
				</div>

				{/* Duplicates .quick_links above — full labels here since there's
				room, unlike the icon-only collapsed bar. */}
				<div className={style.nav_group}>
					<NavLink
						href="/movies"
						activeHrefs={["/movies", "/tv", "/shorts"]}
						icon={MovieIcon}
						className={barStyle.link}
						pathname={pathname}
						iconOnly
						iconSize={20}>
						{dict.nav.media}
					</NavLink>
					<NavLink
						href="/manga"
						activeHrefs={["/manga", "/comics", "/books"]}
						icon={BookOpen}
						className={barStyle.link}
						pathname={pathname}
						iconOnly
						iconSize={20}>
						{dict.nav.reading}
					</NavLink>
					<NavLink
						href="/games"
						icon={GamepadDirectional}
						className={barStyle.link}
						pathname={pathname}
						iconOnly
						iconSize={20}>
						{dict.nav.games}
					</NavLink>
				</div>

				<div className={style.nav_group}>
					<NavLink
						href="/activity"
						icon={ActivityIcon}
						className={barStyle.link}
						pathname={pathname}
						iconOnly
						iconSize={20}
						prefetch>
						{dict.nav.activity}
					</NavLink>
					<NavLink
						href="/reviews"
						icon={LayoutList}
						className={barStyle.link}
						pathname={pathname}
						iconOnly
						iconSize={20}
						prefetch>
						{dict.nav.reviews}
					</NavLink>
					<NavLink
						href="/lists"
						icon={List}
						className={barStyle.link}
						pathname={pathname}
						iconOnly
						iconSize={20}
						prefetch>
						{dict.nav.lists}
					</NavLink>
				</div>

				{/* Anchored to the drawer's bottom edge (see .nav_group_signout) —
				sign-out is normally account-page-only (SignOutButton's own
				comment); the drawer's an exception since it's opt-in. */}
				{signedIn && (
					<div className={`${style.nav_group} ${style.nav_group_signout}`}>
						<SignOutButton />
					</div>
				)}
			</div>
		</>
	);
}
