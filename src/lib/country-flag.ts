// ISO 3166-1 alpha-2 -> flag emoji, via the regional indicator symbol offset
// (each letter maps to U+1F1E6..U+1F1FF, mirroring A-Z) — no lookup table needed.
export function countryFlagEmoji(alpha2: string): string {
	return [...alpha2.toUpperCase()]
		.map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
		.join("");
}
