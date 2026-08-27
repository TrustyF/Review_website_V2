import Link from "next/link";
import { Menu, X } from "lucide-react";
import { AccountIcon } from "@/components/icons/account-icon";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { isNavActive } from "@/lib/nav-active";
import style from "./nav-bar.module.sass";

type Props = {
	signedIn: boolean;
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
	mobileOpen: boolean;
	onToggle: () => void;
};

// Hidden above $mobile-breakpoint (see .mobile_controls in
// nav-bar.module.sass) — groups the avatar and hamburger so a single
// margin-left: auto (on .mobile_controls itself) pushes them to the bar's
// right edge together, rather than each icon's own auto margin fighting the
// other for the same leftover space.
export function NavMobileControls({
	signedIn,
	pathname,
	avatarSrc,
	showAvatar,
	onAvatarError,
	mobileOpen,
	onToggle,
}: Props) {
	return (
		<div className={style.mobile_controls}>
			{/* The full account row (bell + avatar) lives inside the drawer too
			(see NavAccountMenu), but both stay visible in the bar even with the
			drawer closed, same as the hamburger beside them, rather than being
			hidden away a tap deeper than everything else — and
			.account_identity itself is hidden at this width so they don't show
			up twice. Skipped entirely while signed out — there's nothing to
			show yet, and "Sign in" is one tap away in the drawer regardless. */}
			{signedIn && (
				<>
					<NotificationBell />
					<Link
						href="/account"
						className={style.mobile_account_link}
						aria-current={
							isNavActive(pathname, "/account") ? "page" : undefined
						}
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
							<AccountIcon size={18} className={style.nav_icon} />
						)}
					</Link>
				</>
			)}

			{/* Toggles the mobile drawer via the [data-mobile-open] attribute
			nav-bar.tsx sets on <nav> (see its own comment). data-mobile-toggle
			marks it for useMobileDrawer's handleNavClick, which otherwise
			closes the drawer on every "a, button" click inside <nav>. */}
			<button
				type="button"
				data-mobile-toggle
				className={style.mobile_toggle}
				aria-expanded={mobileOpen}
				aria-label={mobileOpen ? "Close menu" : "Open menu"}
				onClick={onToggle}>
				{mobileOpen ? <X size={20} /> : <Menu size={20} />}
			</button>
		</div>
	);
}
