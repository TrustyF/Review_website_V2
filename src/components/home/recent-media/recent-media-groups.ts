import { MediaType } from "@prisma/client";

// Lazy home blocks below the movie sections: each gets its own releases rows (per type)
// and one shared "Recently read/played" row. Order here is page order.
export const RECENT_MEDIA_GROUPS = {
	READING: [MediaType.BOOK, MediaType.MANGA, MediaType.COMIC],
	GAME: [MediaType.GAME],
} as const satisfies Record<string, readonly MediaType[]>;

export type RecentMediaGroup = keyof typeof RECENT_MEDIA_GROUPS;

export function isRecentMediaGroup(value: string): value is RecentMediaGroup {
	return Object.hasOwn(RECENT_MEDIA_GROUPS, value);
}
