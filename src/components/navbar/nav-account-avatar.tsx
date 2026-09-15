import { Link } from "@/components/ui/link";
import { AccountIcon } from "@/components/icons/account-icon";
import { isNavActive } from "@/lib/nav-active";
import style from "./nav-bar.module.sass";

type Props = {
	pathname: string;
	avatarSrc: string | null;
	showAvatar: boolean;
	onAvatarError: () => void;
	className: string | undefined;
	// Fallback-icon size only — the real avatar image is sized by
	// className's own .nav_avatar rule (nav-bar.module.sass).
	iconSize?: number;
};

// /account link: avatar image if the user has one, fallback icon otherwise.
export function NavAccountAvatar({
	pathname,
	avatarSrc,
	showAvatar,
	onAvatarError,
	className,
	iconSize = 14,
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
