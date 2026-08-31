import { CirclePlus, Users } from "lucide-react";
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
			<NavLink
				href="/admin/user-lists"
				icon={Users}
				className={barStyle.link}
				pathname={pathname}>
				User lists
			</NavLink>
		</div>
	);
}
