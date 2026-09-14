"use client";
import {
	BookOpen,
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
import style from "./nav-bar-desktop.module.sass";

type Props = {
	signedIn: boolean;
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
	isAdmin: boolean;
};

// Inline row shown at/above $mobile-breakpoint. Always mounted alongside
// NavBarMobile; nav-bar-desktop.module.sass hides it below the breakpoint.
export function NavBarDesktop({
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
					</div>

					{/* NavSearch's expand spends leftover room in .groups, pushing
					earlier groups aside via their own flex-shrink once it runs out. */}
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

			{isAdmin && <NavAdminLinks pathname={pathname} />}
		</>
	);
}
