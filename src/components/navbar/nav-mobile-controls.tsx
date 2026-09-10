"use client";
import { Menu, X } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NavAccountAvatar } from "@/components/navbar/nav-account-avatar";
import { useDictionary } from "@/lib/i18n/i18n-context";
import style from "./nav-mobile-controls.module.sass";

type Props = {
	signedIn: boolean;
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
	mobileOpen: boolean;
	onToggle: () => void;
};

// Groups the avatar and hamburger so a single margin-left: auto (on
// .mobile_controls) pushes them together, rather than fighting each other.
export function NavMobileControls({
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
		<div className={style.mobile_controls}>
			{/* Also in drawer (NavAccountMenu), stays visible in bar. .account_identity hidden at this width (no duplication). Skipped when signed out. */}
			{signedIn && (
				<>
					<NotificationBell />
					<NavAccountAvatar
						pathname={pathname}
						avatarSrc={avatarSrc}
						showAvatar={showAvatar}
						onAvatarError={onAvatarError}
						className={style.mobile_account_link}
						iconSize={18}
					/>
				</>
			)}

			{/* Toggles [data-mobile-open] on <nav>; data-mobile-toggle marks it so
			useMobileDrawer's handleNavClick doesn't also close the drawer on it. */}
			<button
				type="button"
				data-mobile-toggle
				className={style.mobile_toggle}
				aria-expanded={mobileOpen}
				aria-label={mobileOpen ? dict.nav.closeMenu : dict.nav.openMenu}
				onClick={onToggle}>
				{mobileOpen ? <X size={20} /> : <Menu size={20} />}
			</button>
		</div>
	);
}
