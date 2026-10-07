// Single source of truth for the tag string, shared by cache writers and invalidators so they can't drift.
export function mediaCacheTag(mediaId: number) {
	return `media:${mediaId}`;
}

// The home page's person spotlight candidate list; cleared whenever a rating changes.
export const PERSON_SPOTLIGHT_TAG = "person-spotlight";
