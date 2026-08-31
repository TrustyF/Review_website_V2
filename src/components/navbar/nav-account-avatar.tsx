import { Link } from "@/components/ui/link";
import { AccountIcon } from "@/components/icons/account-icon";
import { isNavActive } from "@/lib/nav-active";
import style from "./nav-bar.module.sass";

type Props = {
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
	// Desktop and mobile pass their own wrapping layout class.
	className: string | undefined;
	// 18px on mobile to match the bigger tap target there, 14px elsewhere.
	iconSize: number;
};

// Shared /account link (avatar-or-fallback-icon) between desktop and mobile.
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
				// Always icon-only (no label to pair with), so full brightness.
				<AccountIcon
					size={iconSize}
					className={`${style.nav_icon} ${style.nav_icon_always}`}
				/>
			)}
		</Link>
	);
}
