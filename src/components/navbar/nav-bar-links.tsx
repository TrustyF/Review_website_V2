"use client";
import {
	BookOpen,
	ChartLine,
	GamepadDirectional,
	LayoutList,
	List,
} from "lucide-react";
import { ActivityIcon } from "@/components/icons/activity-icon";
import { MovieIcon } from "@/components/icons/movie-icon";
import { NavSearch } from "@/components/navbar/nav-search/nav-search";
import { NavLink } from "@/components/navbar/nav-link";
import { NavAccountMenu } from "@/components/navbar/nav-account-menu";
import { NavAdminLinks } from "@/components/navbar/nav-admin-links";
import { useDictionary } from "@/lib/i18n/i18n-context";
import barStyle from "./nav-bar.module.sass";
import style from "./nav-bar-links.module.sass";

type Props = {
	signedIn: boolean;
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
	isAdmin: boolean;
};

// Desktop-only nav row. Below $mobile-breakpoint this hides entirely (see
// its own .nav_content media query) and NavBarMobile takes over instead.
export function NavBarLinks({
	signedIn,
	pathname,
	avatarSrc,
	showAvatar,
	onAvatarError,
	isAdmin,
}: Props) {
	const dict = useDictionary();

	return (
		<>
			<div className={style.nav_content}>
				<div className={style.groups}>
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
							// Static-ish, safe to prefetch eagerly, unlike /account below.
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
						<NavLink
							href="/stats"
							icon={ChartLine}
							className={barStyle.link}
							pathname={pathname}
							iconOnly
							prefetch>
							{dict.nav.stats}
						</NavLink>
					</div>

					{/* NavSearch's expand spends leftover room in .groups. Below
					$mobile-breakpoint it's just a trigger that routes to /search. */}
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

			{/* Admin tools stay desktop-only — nav-admin-links.module.sass hides
			the absolutely-positioned corner cluster below $mobile-breakpoint. */}
			{isAdmin && <NavAdminLinks pathname={pathname} />}
		</>
	);
}
