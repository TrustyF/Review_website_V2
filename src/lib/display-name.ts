// Fallback chain: editable username > signup name > email > id, so a
// caller never has to special-case "nothing to show".
export function displayName(user: {
	username?: string | null | undefined;
	name?: string | null | undefined;
	email?: string | null | undefined;
	id?: string | undefined;
}): string {
	return user.username || user.name || user.email || user.id || "";
}
