"use client";
import { Link } from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LucideProvider } from "lucide-react";
import { LogoImage } from "@/components/logo/logo-image";
import { NavBarLinks } from "@/components/navbar/nav-bar-links";
import { NavBarMobile } from "@/components/navbar/nav-bar-mobile";
import { useNavbarVisibility } from "@/components/navbar/use-navbar-visibility";
import { useMobileDrawer } from "@/components/navbar/use-mobile-drawer";
import { useAvatarImage } from "@/components/navbar/use-avatar-image";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useAvatar } from "@/components/account/avatar-context";
import { useDictionary } from "@/lib/i18n/i18n-context";
import style from "./nav-bar.module.sass";

export default function Navbar() {
	const dict = useDictionary();
	const { data: session } = useSession();
	// Fetched client-side since the session JWT only refreshes at sign-in.
	const { avatarSrc } = useAvatar();
	const isAdmin = useIsAdmin();
	const pathname = usePathname();
	const hidden = useNavbarVisibility();
	const { mobileOpen, setMobileOpen, handleNavClick } = useMobileDrawer();
	const { showAvatar, onAvatarError } = useAvatarImage(avatarSrc);
	const signedIn = Boolean(session?.user);

	return (
		// Nav icons render at 14px, where Lucide's default (24px-viewBox) stroke looks
		// soft. absoluteStrokeWidth fixes it at 1.5px here instead of per <Icon> call site.
		<LucideProvider strokeWidth={1.5} absoluteStrokeWidth>
			<nav
				className={`${style.wrapper} ${hidden ? style.hidden : ""}`}
				// Scoped to <nav>'s own subtree, unlike --navbar-offset which page
				// content elsewhere needs as a real global.
				data-mobile-open={mobileOpen}
				onClick={handleNavClick}>
				<Link
					href="/"
					className={style.title}
					aria-label={dict.nav.homeAriaLabel}>
					<LogoImage />
				</Link>

				{/* Both always mount; each one's own CSS decides visibility at
				$mobile-breakpoint, so a mobile tweak can't reach desktop or vice versa. */}
				<NavBarLinks
					signedIn={signedIn}
					pathname={pathname}
					avatarSrc={avatarSrc}
					showAvatar={showAvatar}
					onAvatarError={onAvatarError}
					isAdmin={isAdmin}
				/>
				<NavBarMobile
					signedIn={signedIn}
					pathname={pathname}
					avatarSrc={avatarSrc}
					showAvatar={showAvatar}
					onAvatarError={onAvatarError}
					mobileOpen={mobileOpen}
					onToggle={() => setMobileOpen((open) => !open)}
				/>
			</nav>
		</LucideProvider>
	);
}
