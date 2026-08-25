import { CirclePlus, Users } from "lucide-react";
import { NavLink } from "@/components/navbar/nav-link";
import style from "./nav-bar.module.sass";

type Props = {
	pathname: string;
};

// Detached from the .nav_group flex flow and pinned to its own corner
// instead (see .add_media_link in nav-bar.module.sass) — still a child of
// <nav> (not a separate fixed element), so it still hides/reveals in step
// with the rest of the navbar on scroll. Hidden below $mobile-breakpoint —
// the admin tools aren't offered on mobile at all.
export function NavAdminLinks({ pathname }: Props) {
	return (
		<div className={style.add_media_link}>
			<NavLink
				href="/add"
				icon={CirclePlus}
				className={style.link}
				pathname={pathname}>
				Add media
			</NavLink>
			<NavLink
				href="/admin/user-lists"
				icon={Users}
				className={style.link}
				pathname={pathname}>
				User lists
			</NavLink>
		</div>
	);
}
