// Shared row-timestamp format for activity-shaped lists — short month + day, no
// year, locale-aware. Activity feed is the baseline this matches.
export function listDateFormatterFor(locale: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
		month: "short",
		day: "numeric",
	});
}
