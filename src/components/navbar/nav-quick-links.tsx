"use client";
import { BookOpen, GamepadDirectional } from "lucide-react";
import { MovieIcon } from "@/components/icons/movie-icon";
import { NavLink } from "@/components/navbar/nav-link";
import { useDictionary } from "@/lib/i18n/i18n-context";
import style from "./nav-bar.module.sass";
import quickStyle from "./nav-quick-links.module.sass";

type Props = { pathname: string };

// Media/Reading/Games kept out of the hamburger drawer on mobile — shown
// directly on the collapsed bar instead, next to the avatar/hamburger.
export function NavQuickLinks({ pathname }: Props) {
	const dict = useDictionary();
	return (
		<div className={quickStyle.quick_links}>
			<NavLink
				href="/movies"
				activeHrefs={["/movies", "/tv", "/shorts"]}
				icon={MovieIcon}
				className={style.link}
				iconOnly
				pathname={pathname}>
				{dict.nav.media}
			</NavLink>
			<NavLink
				href="/manga"
				activeHrefs={["/manga", "/comics", "/books"]}
				icon={BookOpen}
				className={style.link}
				iconOnly
				pathname={pathname}>
				{dict.nav.reading}
			</NavLink>
			<NavLink
				href="/games"
				icon={GamepadDirectional}
				className={style.link}
				iconOnly
				pathname={pathname}>
				{dict.nav.games}
			</NavLink>
		</div>
	);
}
