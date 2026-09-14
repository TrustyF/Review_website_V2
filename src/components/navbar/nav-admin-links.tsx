"use client";
import { useEffect, useState } from "react";
import { CirclePlus, Crop, Image, MessageCircleQuestion, ScrollText, Users } from "lucide-react";
import { NavLink } from "@/components/navbar/nav-link";
import { getPendingRecommendationRequestCount } from "@/components/recommendations/recommendation-request-actions";
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
	const [pendingCount, setPendingCount] = useState(0);

	// Refetch on route change, not polling — same tradeoff as NotificationBell.
	useEffect(() => {
		let cancelled = false;
		getPendingRecommendationRequestCount().then((count) => {
			if (!cancelled) setPendingCount(count);
		});
		return () => {
			cancelled = true;
		};
	}, [pathname]);

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
				<div className={style.badge_wrap}>
					<NavLink
						href="/admin/recommendation-requests"
						icon={MessageCircleQuestion}
						className={barStyle.link}
						pathname={pathname}>
						{dict.nav.recommendationRequests}
					</NavLink>
					{pendingCount > 0 && (
						<span className={style.badge}>
							{pendingCount > 9 ? "9+" : pendingCount}
						</span>
					)}
				</div>
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
