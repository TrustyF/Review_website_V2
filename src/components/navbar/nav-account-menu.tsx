"use client";
import { LogIn } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NavLink } from "@/components/navbar/nav-link";
import { NavAccountAvatar } from "@/components/navbar/nav-account-avatar";
import { useDictionary } from "@/lib/i18n/i18n-context";
import barStyle from "./nav-bar.module.sass";
import style from "./nav-account-menu.module.sass";

type Props = {
	signedIn: boolean;
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
	// Passed through to NavAccountAvatar's fallback-icon size.
	avatarIconSize?: number;
};

// Signed in: bell + avatar link; signed out: link to /login. Sign-out lives
// on the account page. Same row at every width.
export function NavAccountMenu({
	signedIn,
	pathname,
	avatarSrc,
	showAvatar,
	onAvatarError,
	avatarIconSize = 14,
}: Props) {
	const dict = useDictionary();

	if (!signedIn) {
		return (
			<NavLink
				href="/login"
				icon={LogIn}
				className={style.sign_out_button}
				pathname={pathname}>
				{dict.auth.signIn}
			</NavLink>
		);
	}

	return (
		<div className={style.account_identity}>
			<NavAccountAvatar
				pathname={pathname}
				avatarSrc={avatarSrc}
				showAvatar={showAvatar}
				onAvatarError={onAvatarError}
				className={barStyle.link}
				iconSize={avatarIconSize}
			/>
			<NotificationBell />
		</div>
	);
}
