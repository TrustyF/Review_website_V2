import { Link } from "@/components/ui/link";
import { AccountIcon } from "@/components/icons/account-icon";
import { isNavActive } from "@/lib/nav-active";
import style from "./nav-bar.module.sass";

type Props = {
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
	// CSS module class lookup, same reasoning as NavLink's own className prop
	// (nav-link.tsx) — desktop (NavAccountMenu) and mobile (NavMobileControls)
	// each wrap this in their own layout class.
	className: string | undefined;
	// 18px on mobile vs 14px everywhere else — the fallback AccountIcon has to
	// fill the same bigger tap target mobile's other nav icons use there.
	iconSize: number;
};

// The /account link with its avatar-or-fallback-icon content — identical
// between NavAccountMenu's desktop row and NavMobileControls's own, aside
// from the wrapping class and icon size (see their own callers), so it's
// shared here rather than hand-copied in both.
export function NavAccountAvatar({
	pathname,
	avatarSrc,
	showAvatar,
	onAvatarError,
	className,
	iconSize,
}: Props) {
	return (
		<Link
			href="/account"
			className={className}
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
				<AccountIcon size={iconSize} className={style.nav_icon} />
			)}
		</Link>
	);
}
