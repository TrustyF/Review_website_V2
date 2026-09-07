import { MediaType } from "@prisma/client";

// Single source of truth for "watched"'s verb, which depends on the media's type —
// screen media is "watched", print media is "read", games are "played".
const WATCHED_VERB_BY_TYPE: Record<MediaType, string> = {
	[MediaType.MOVIE]: "Watched",
	[MediaType.SHORT]: "Watched",
	[MediaType.TVSHOW]: "Watched",
	[MediaType.MANGA]: "Read",
	[MediaType.COMIC]: "Read",
	[MediaType.BOOK]: "Read",
	[MediaType.GAME]: "Played",
};

// "Rewatched" doesn't just re-prefix the verb above ("Reread"/"Replayed" aren't "Re" + "Read"/"Played").
const REWATCHED_VERB_BY_TYPE: Record<MediaType, string> = {
	[MediaType.MOVIE]: "Rewatched",
	[MediaType.SHORT]: "Rewatched",
	[MediaType.TVSHOW]: "Rewatched",
	[MediaType.MANGA]: "Reread",
	[MediaType.COMIC]: "Reread",
	[MediaType.BOOK]: "Reread",
	[MediaType.GAME]: "Replayed",
};

// "Watched on 12 Jan 2026", "Read on ...", "Played on ..." — the date-line label used on
// change-log rows and review cards.
export function watchedOnLabel(type: MediaType): string {
	return `${WATCHED_VERB_BY_TYPE[type]} on`;
}

// "Rewatched on ...", "Reread on ...", "Replayed on ..." — the change-log milestone label.
export function rewatchedOnLabel(type: MediaType): string {
	return `${REWATCHED_VERB_BY_TYPE[type]} on`;
}

// "Rewatched", "Reread", "Replayed" — the activity feed's bare action verb.
export function rewatchedVerb(type: MediaType): string {
	return REWATCHED_VERB_BY_TYPE[type];
}

// "Recently watched", "Recently read", "Recently played" — home page section titles.
export function recentlyWatchedTitle(type: MediaType): string {
	return `Recently ${WATCHED_VERB_BY_TYPE[type].toLowerCase()}`;
}

// "Mark as watched"/"Mark as read"/"Mark as played" — the per-user watched toggle's label.
export function markAsWatchedLabel(type: MediaType): string {
	return `Mark as ${WATCHED_VERB_BY_TYPE[type].toLowerCase()}`;
}

// "Already watched"/"Already read"/"Already played" — the toggle's active-state label.
export function alreadyWatchedLabel(type: MediaType): string {
	return `Already ${WATCHED_VERB_BY_TYPE[type].toLowerCase()}`;
}
