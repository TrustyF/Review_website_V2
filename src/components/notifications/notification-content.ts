import { ListPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "@prisma/client";
import type { NotificationEntry } from "@/components/notifications/notification-actions";

// One switch per concern, each exhaustive over NotificationType (missing a
// case is a compile error) — this file is the one place a new notification
// type needs a case added; the schema, write sites, and read/UI code around
// it don't otherwise need to know how a given type renders or where it
// links.

export function getNotificationHref(entry: NotificationEntry): string | null {
	switch (entry.type) {
		case "LIST_CREATED":
		case "LIST_ITEM_ADDED":
			return entry.list ? `/lists/${entry.list.id}` : null;
	}
}

// Feeds TimelineRow's target/action/value slots — the same three-piece shape
// activity-feed.tsx's own activityLabel returns, so both feeds render through
// one shared row layout (see timeline-row.tsx). `target` here is always plain
// text, never a Link: NotificationFeed makes the whole row clickable (see
// getNotificationHref), and a Link can't nest inside a Link.
//
// Only ever called for a plain (non-grouped) row — a LIST_ITEM_ADDED entry
// with groupedMedia set renders through ListAdditionsCard instead.
export function getNotificationRowContent(entry: NotificationEntry): {
	target: string;
	action: string | null;
	value: string | null;
} {
	switch (entry.type) {
		case "LIST_CREATED":
			return {
				target: entry.list?.title ?? "A new list was made for you",
				action: "Created list for you",
				value: null,
			};
		case "LIST_ITEM_ADDED":
			return {
				target: entry.media?.title ?? "An item",
				action: "Added to",
				value: entry.list?.title ?? null,
			};
	}
}

// Indexed directly at the call site (same as activity-feed.tsx's own
// TYPE_ICON) rather than through a getter function — react-hooks/
// static-components can prove a plain object index is a stable component
// reference but can't see through a function call to the same effect, and
// would otherwise flag `<Icon .../>` as a component created during render.
export const NOTIFICATION_TYPE_ICON: Record<NotificationType, LucideIcon> = {
	LIST_CREATED: ListPlus,
	LIST_ITEM_ADDED: ListPlus,
};
