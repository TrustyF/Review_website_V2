// Shared row-timestamp format for activity-shaped lists — short month + day, no
// year, locale-aware. `year` opts in for long-lived lists (change log).
export function listDateFormatterFor(
	locale: string,
	{ year = false }: { year?: boolean } = {},
): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
		...(year ? { year: "numeric" } : {}),
		month: "short",
		day: "numeric",
	});
}
