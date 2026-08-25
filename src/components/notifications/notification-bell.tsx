"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { getUnreadNotificationCount } from "@/components/notifications/notification-actions";
import { isNavActive } from "@/lib/nav-active";
import style from "./notification-bell.module.sass";

// Refetches on every route change (App Router layouts, nav-bar's included,
// stay mounted across client-side navigation — see nav-bar.tsx's own
// pathname usage) rather than only once on mount, since that's the one
// "navigation" signal already available here without adding polling/SSE —
// see notification-actions.ts's own comment on why this repo has neither.
export function NotificationBell() {
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
				unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"
			}
			title="Notifications">
			<Bell size={14} />
			{unreadCount > 0 && (
				<span className={style.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
			)}
		</Link>
	);
}
