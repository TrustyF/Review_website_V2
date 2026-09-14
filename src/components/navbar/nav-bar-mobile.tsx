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

// Collapsed bar (search + account + hamburger) below $mobile-breakpoint,
// plus the full-label drawer the hamburger opens. NavBarLinks covers desktop.
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
				<NavSearch />
				<NavAccountMenu
					signedIn={signedIn}
					pathname={pathname}
					avatarSrc={avatarSrc}
					showAvatar={showAvatar}
					onAvatarError={onAvatarError}
				/>
				<Clickable
					className={style.toggle}
					aria-label={mobileOpen ? dict.nav.closeMenu : dict.nav.openMenu}
					aria-pressed={mobileOpen}
					onClick={onToggle}>
					{mobileOpen ? <X size={20} /> : <Menu size={20} />}
				</Clickable>
			</div>

			{/* data-nav-drawer marks this so nav-bar.module.sass reveals the
			iconOnly items' labels here (Activity/Reviews/Lists). */}
			<div className={style.drawer} data-nav-drawer>
				<div className={style.nav_group}>
					<NavLink
						href="/movies"
						activeHrefs={["/movies", "/tv", "/shorts"]}
						icon={MovieIcon}
						className={barStyle.link}
						pathname={pathname}>
						{dict.nav.media}
					</NavLink>
					<NavLink
						href="/manga"
						activeHrefs={["/manga", "/comics", "/books"]}
						icon={BookOpen}
						className={barStyle.link}
						pathname={pathname}>
						{dict.nav.reading}
					</NavLink>
					<NavLink
						href="/games"
						icon={GamepadDirectional}
						className={barStyle.link}
						pathname={pathname}>
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
						prefetch>
						{dict.nav.activity}
					</NavLink>
					<NavLink
						href="/reviews"
						icon={LayoutList}
						className={barStyle.link}
						pathname={pathname}
						iconOnly
						prefetch>
						{dict.nav.reviews}
					</NavLink>
					<NavLink
						href="/lists"
						icon={List}
						className={barStyle.link}
						pathname={pathname}
						iconOnly
						prefetch>
						{dict.nav.lists}
					</NavLink>
				</div>
			</div>
		</>
	);
}
