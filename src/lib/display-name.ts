// Shared fallback chain for showing a person's name — username (the
// editable override, set on /account/settings) beats name (set once at
// signup, never editable), which beats email, which beats the bare id as a
// last resort so a caller never has to special-case "nothing to show".
// Every call site that used to read a bare `.name` should go through this
// instead, so the fallback order can't drift between them.
export function displayName(user: {
	username?: string | null | undefined;
	name?: string | null | undefined;
	email?: string | null | undefined;
	id?: string | undefined;
}): string {
	return user.username || user.name || user.email || user.id || "";
}
