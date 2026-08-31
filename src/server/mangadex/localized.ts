// MangaDex localized strings don't reliably include "en" (e.g. Berserk's title is "ja-ro"-only).
// Prefer English, fall back to romanized Japanese, then whatever's first.
const PREFERRED_LOCALES = ["en", "ja-ro"];

export function pickLocalized(values: Record<string, string>): string | null {
	for (const locale of PREFERRED_LOCALES) {
		if (values[locale]) return values[locale];
	}
	return Object.values(values)[0] ?? null;
}

// The primary title isn't necessarily English, but an English altTitles entry often exists instead
// (e.g. Berserk's altTitles include {en: "Berserk"} though its main title doesn't).
export function pickEnglishTitle(
	title: Record<string, string>,
	altTitles: Record<string, string>[],
): string | null {
	if (title.en) return title.en;

	const altEnglish = altTitles.find((alt) => alt.en)?.en;
	if (altEnglish) return altEnglish;

	return pickLocalized(title);
}

// Romanized Japanese title for display alongside the English one. Only considers "ja-ro", never raw
// kanji/kana ("ja"), so it stays readable without a Japanese font. Picks the first candidate that
// isn't a duplicate of the English title; null if none exists or all match it.
export function pickNativeTitle(
	title: Record<string, string>,
	altTitles: Record<string, string>[],
	englishTitle: string | null,
): string | null {
	const candidates = [
		title["ja-ro"],
		...altTitles.map((alt) => alt["ja-ro"]),
	].filter((value): value is string => Boolean(value));

	return candidates.find((value) => value !== englishTitle) ?? null;
}
