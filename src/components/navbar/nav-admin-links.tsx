"use client";
import { CirclePlus, Crop, Image, ScrollText, Users } from "lucide-react";
import { NavLink } from "@/components/navbar/nav-link";
import { useDictionary } from "@/lib/i18n/i18n-context";
import barStyle from "./nav-bar.module.sass";
import style from "./nav-admin-links.module.sass";

type Props = {
	pathname: string;
};

// Pinned to its own corner, but still a child of <nav> so it hides/reveals
// with the rest of the navbar on scroll. Hidden on mobile.
export function NavAdminLinks({ pathname }: Props) {
	const dict = useDictionary();

	return (
		<div className={style.add_media_link}>
			<NavLink
				href="/add"
				icon={CirclePlus}
				className={barStyle.link}
				pathname={pathname}>
				{dict.nav.addMedia}
			</NavLink>
			<div className={style.group}>
				<NavLink
					href="/admin/user-lists"
					icon={Users}
					className={barStyle.link}
					pathname={pathname}>
					{dict.nav.userLists}
				</NavLink>
				<NavLink
					href="/admin/logs"
					icon={ScrollText}
					className={barStyle.link}
					pathname={pathname}>
					{dict.nav.cronLogs}
				</NavLink>
				<NavLink
					href="/admin/digest"
					icon={Image}
					className={barStyle.link}
					pathname={pathname}>
					{dict.nav.digest}
				</NavLink>
				<NavLink
					href="/dev/image-crop"
					icon={Crop}
					className={barStyle.link}
					pathname={pathname}
					target="_blank">
					{dict.nav.imageCrop}
				</NavLink>
			</div>
		</div>
	);
}
