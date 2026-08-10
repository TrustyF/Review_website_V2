// Just a preference stored on the account (User.preferredLanguage) — no
// i18n library or actual translations exist yet, see /account's own note.
export const LANGUAGE_OPTIONS = [
	{ value: "en", label: "English" },
	{ value: "fr", label: "French" },
	{ value: "es", label: "Spanish" },
	{ value: "de", label: "German" },
	{ value: "nl", label: "Dutch" },
] as const;
