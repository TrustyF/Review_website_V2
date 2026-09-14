"use client";
import { LayoutList, List } from "lucide-react";
import { ActivityIcon } from "@/components/icons/activity-icon";
import { NavSearch } from "@/components/navbar/nav-search/nav-search";
import { NavLink } from "@/components/navbar/nav-link";
import { NavAccountMenu } from "@/components/navbar/nav-account-menu";
import { NavQuickLinks } from "@/components/navbar/nav-quick-links";
import { NavMobileControls } from "@/components/navbar/nav-mobile-controls";
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

// Collapsed bar + drawer shown below $mobile-breakpoint. Always mounted
// alongside NavBarDesktop; nav-bar-mobile.module.sass hides it above it.
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
			{/* data-nav-drawer marks this so nav-bar.module.sass can reveal iconOnly
			labels inside it, without touching NavQuickLinks's always-icon-only links. */}
			<div className={style.drawer} data-nav-drawer>
				<div className={style.groups}>
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

					<div className={style.nav_group}>
						<NavSearch />
					</div>
				</div>

				<div className={style.nav_group}>
					<NavAccountMenu
						signedIn={signedIn}
						pathname={pathname}
						avatarSrc={avatarSrc}
						showAvatar={showAvatar}
						onAvatarError={onAvatarError}
					/>
				</div>
			</div>

			{/* Kept out of the drawer so Media/Reading/Games stay reachable with
			the drawer closed. */}
			<div className={style.mobile_end}>
				<NavQuickLinks pathname={pathname} />
				<NavMobileControls
					signedIn={signedIn}
					pathname={pathname}
					avatarSrc={avatarSrc}
					showAvatar={showAvatar}
					onAvatarError={onAvatarError}
					mobileOpen={mobileOpen}
					onToggle={onToggle}
				/>
			</div>
		</>
	);
}
