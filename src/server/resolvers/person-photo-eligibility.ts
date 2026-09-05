// Which roles are worth downloading/caching a photo for. Person.photoPath populated for all cast/crew (free to store); this prevents requests for people no one looks up (Gaffer, Sound Editor, ...).
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
