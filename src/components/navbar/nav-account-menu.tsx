import { LogIn } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NavLink } from "@/components/navbar/nav-link";
import { NavAccountAvatar } from "@/components/navbar/nav-account-avatar";
import barStyle from "./nav-bar.module.sass";
import style from "./nav-account-menu.module.sass";

type Props = {
	signedIn: boolean;
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
};

// Signed in: bell + avatar link; signed out: link to /login. Sign-out lives
// on the account page. Hidden in the mobile drawer (NavMobileControls covers it).
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
				pathname={pathname}>
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
