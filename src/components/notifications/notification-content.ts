import { ListPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "@prisma/client";
import type { NotificationEntry } from "@/components/notifications/notification-actions";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

// One switch per concern, each exhaustive over NotificationType. New type needs case here only; schema/write sites/read/UI don't know how it renders.

export function getNotificationHref(entry: NotificationEntry): string | null {
	switch (entry.type) {
		case "LIST_CREATED":
		case "LIST_ITEM_ADDED":
			return entry.list ? `/lists/${entry.list.id}` : null;
	}
}

// Three-piece shape for timeline row; target text only (row clickable).
// Plain rows only—grouped renders ListAdditionsCard.
export function getNotificationRowContent(
	entry: NotificationEntry,
	dict: Dictionary,
): {
	target: string;
	action: string | null;
	value: string | null;
} {
	switch (entry.type) {
		case "LIST_CREATED":
			return {
				target: entry.list?.title ?? dict.notifications.newListForYou,
				action: dict.notifications.createdListForYou,
				value: null,
			};
		case "LIST_ITEM_ADDED":
			return {
				target: entry.media?.title ?? dict.notifications.anItem,
				action: dict.activity.addedTo,
				value: entry.list?.title ?? null,
			};
	}
}

// Indexed directly (not via function) so react-hooks/static-components sees stable reference.
export const NOTIFICATION_TYPE_ICON: Record<NotificationType, LucideIcon> = {
	LIST_CREATED: ListPlus,
	LIST_ITEM_ADDED: ListPlus,
};
