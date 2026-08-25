import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";
import { AccountIcon } from "@/components/icons/account-icon";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NavLink } from "@/components/navbar/nav-link";
import { COLLAPSE_TIER } from "@/components/navbar/nav-constants";
import { isNavActive } from "@/lib/nav-active";
import style from "./nav-bar.module.sass";

type Props = {
	signedIn: boolean;
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
};

// The desktop .nav_group_end cluster — signed in shows the notification
// bell, avatar/account link, and a sign-out button; signed out just links to
// /login. Both already live outside the drawer at mobile widths too (see
// NavMobileControls) — this group is hidden there (see its own rule in
// nav-bar.module.sass) so they don't show up twice, but stays for desktop,
// where the drawer doesn't exist and this row is the only place they live.
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
		<>
			<div className={style.account_identity}>
				<NotificationBell />
				<Link
					href="/account"
					className={style.link}
					aria-current={isNavActive(pathname, "/account") ? "page" : undefined}
					aria-label="Account"
					title="Account">
					{showAvatar && avatarSrc ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={avatarSrc}
							alt=""
							className={style.nav_avatar}
							onError={onAvatarError}
						/>
					) : (
						<AccountIcon size={14} className={style.nav_icon} />
					)}
				</Link>
			</div>
			<button
				type="button"
				className={style.sign_out_button}
				onClick={() => signOut({ callbackUrl: "/" })}>
				<LogOut size={14} className={style.nav_icon} />
				<span className={style[`link_label_tier${COLLAPSE_TIER.ACCOUNT}`]}>
					Sign out
				</span>
			</button>
		</>
	);
}
