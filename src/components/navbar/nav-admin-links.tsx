import { CirclePlus, Crop, Image, ScrollText, Users } from "lucide-react";
import { NavLink } from "@/components/navbar/nav-link";
import barStyle from "./nav-bar.module.sass";
import style from "./nav-admin-links.module.sass";

type Props = {
	pathname: string;
};

// Pinned to its own corner, but still a child of <nav> so it hides/reveals
// with the rest of the navbar on scroll. Hidden on mobile.
export function NavAdminLinks({ pathname }: Props) {
	return (
		<div className={style.add_media_link}>
			<NavLink
				href="/add"
				icon={CirclePlus}
				className={barStyle.link}
				pathname={pathname}>
				Add media
			</NavLink>
			<div className={style.group}>
				<NavLink
					href="/admin/user-lists"
					icon={Users}
					className={barStyle.link}
					pathname={pathname}>
					User lists
				</NavLink>
				<NavLink
					href="/admin/logs"
					icon={ScrollText}
					className={barStyle.link}
					pathname={pathname}>
					Cron logs
				</NavLink>
				<NavLink
					href="/admin/digest-banner"
					icon={Image}
					className={barStyle.link}
					pathname={pathname}>
					Digest
				</NavLink>
				<NavLink
					href="/dev/image-crop"
					icon={Crop}
					className={barStyle.link}
					pathname={pathname}
					target="_blank">
					Image crop
				</NavLink>
			</div>
		</div>
	);
}
