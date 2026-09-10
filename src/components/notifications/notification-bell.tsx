"use client";
import { useEffect, useState } from "react";
import { Link } from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { getUnreadNotificationCount } from "@/components/notifications/notification-actions";
import { isNavActive } from "@/lib/nav-active";
import { useDictionary } from "@/lib/i18n/i18n-context";
import style from "./notification-bell.module.sass";

// Refetch on route change (pathname signal), not just on mount; avoids polling/SSE
export function NotificationBell() {
	const dict = useDictionary();
	const pathname = usePathname();
	const [unreadCount, setUnreadCount] = useState(0);

	useEffect(() => {
		let cancelled = false;
		getUnreadNotificationCount().then((count) => {
			if (!cancelled) setUnreadCount(count);
		});
		return () => {
			cancelled = true;
		};
	}, [pathname]);

	return (
		<Link
			href="/account/notifications"
			className={style.link}
			aria-current={
				isNavActive(pathname, "/account/notifications") ? "page" : undefined
			}
			aria-label={
				unreadCount > 0
					? dict.notifications.unreadAriaLabel(unreadCount)
					: dict.notifications.title
			}
			title={dict.notifications.title}>
			<Bell size={14} />
			{unreadCount > 0 && (
				<span className={style.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
			)}
		</Link>
	);
}
