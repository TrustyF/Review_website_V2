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
};

// /account link: avatar image if the user has one, fallback icon otherwise.
export function NavAccountAvatar({
	pathname,
	avatarSrc,
	showAvatar,
	onAvatarError,
	className,
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
					size={14}
					className={`${style.nav_icon} ${style.nav_icon_always}`}
				/>
			)}
		</Link>
	);
}
