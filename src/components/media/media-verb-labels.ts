import { MediaType } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

// "Watched on 12 Jan 2026", "Read on ...", "Played on ..." — full phrases per type/locale
// (not composed from a bare verb + " on"), since word order isn't the same across languages.
export function watchedOnLabel(type: MediaType, dict: Dictionary): string {
	return dict.mediaVerb.onLabel[type];
}

// "Rewatched on ...", "Reread on ...", "Replayed on ..." — the change-log milestone label.
export function rewatchedOnLabel(type: MediaType, dict: Dictionary): string {
	return dict.mediaVerb.rewatchedOnLabel[type];
}

// "Rewatched", "Reread", "Replayed" — the activity feed's bare action verb.
export function rewatchedVerb(type: MediaType, dict: Dictionary): string {
	return dict.mediaVerb.rewatchedVerb[type];
}

// "Recently watched", "Recently read", "Recently played" — home page section titles.
export function recentlyWatchedTitle(type: MediaType, dict: Dictionary): string {
	return dict.mediaVerb.recentlyLabel[type];
}

// "Mark as watched"/"Mark as read"/"Mark as played" — the per-user watched toggle's label.
export function markAsWatchedLabel(type: MediaType, dict: Dictionary): string {
	return dict.mediaVerb.markAsLabel[type];
}

// "Already watched"/"Already read"/"Already played" — the toggle's active-state label.
export function alreadyWatchedLabel(type: MediaType, dict: Dictionary): string {
	return dict.mediaVerb.alreadyLabel[type];
}
