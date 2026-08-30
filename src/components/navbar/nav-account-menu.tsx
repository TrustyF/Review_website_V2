import { LogIn } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NavLink } from "@/components/navbar/nav-link";
import { NavAccountAvatar } from "@/components/navbar/nav-account-avatar";
import { COLLAPSE_TIER } from "@/components/navbar/nav-constants";
import barStyle from "./nav-bar.module.sass";
import style from "./nav-account-menu.module.sass";

type Props = {
	signedIn: boolean;
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
};

// The desktop .nav_group_end cluster — signed in shows the notification
// bell and avatar/account link; signed out just links to /login. Sign-out
// itself lives on the account page now (see SignOutButton), not here — it
// isn't reached often enough to earn permanent navbar space on every page.
// Both already live outside the drawer at mobile widths too (see
// NavMobileControls) — this group is hidden there (see its own rule in
// nav-account-menu.module.sass) so they don't show up twice, but stays for
// desktop, where the drawer doesn't exist and this row is the only place
// they live.
export function NavAccountMenu({
	signedIn,
	pathname,
	avatarSrc,
	showAvatar,
	onAvatarError,
}: Props) {
	if (!signedIn) {
		return (
			<NavLink
				href="/login"
				icon={LogIn}
				className={style.sign_out_button}
				pathname={pathname}
				collapseTier={COLLAPSE_TIER.ACCOUNT}>
				Sign in
			</NavLink>
		);
	}

	return (
		<div className={style.account_identity}>
			<NotificationBell />
			<NavAccountAvatar
				pathname={pathname}
				avatarSrc={avatarSrc}
				showAvatar={showAvatar}
				onAvatarError={onAvatarError}
				className={barStyle.link}
				iconSize={14}
			/>
		</div>
	);
}
