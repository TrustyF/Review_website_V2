// Which credited roles are worth actually downloading/caching a person's
// photo for (see poster-resolver.ts's resolvePersonPhoto, reached via
// /api/person-photo). Person.photoPath itself is populated for every cast
// and crew member TMDB hands one back for (see movie-credits.ts/
// tv-show-credits.ts) — that's just a string, free to store — so this is
// what actually keeps a photo from ever being requested for a person nobody
// realistically looks up (a Gaffer, a Sound Editor, ...), not the ingest
// layer. Applied wherever a photo might get shown for a non-Actor credit
// (search-actions.ts's person results, credit-media-list-page.tsx's own
// entity header — CastPhotos on the media detail page needs no check, it
// already only ever supplies a photo for Actor credits).
export const PHOTO_ELIGIBLE_CREDIT_ROLES = new Set([
	"Actor",
	"Director",
	"Writer",
	"Screenplay",
	"Story",
	"Producer",
	"Executive Producer",
]);

// True if any of the given role names (a person's own set of credited
// roles) qualifies them for a photo.
export function hasPhotoEligibleRole(roleNames: Iterable<string>): boolean {
	for (const name of roleNames) {
		if (PHOTO_ELIGIBLE_CREDIT_ROLES.has(name)) return true;
	}
	return false;
}
