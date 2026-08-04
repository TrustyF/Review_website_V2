// MangaDex localizes strings (titles, descriptions, tag names) as a map of
// language code -> value, and doesn't reliably include "en" (e.g. Berserk's
// title only has "ja-ro"). Prefer English, fall back to the romanized
// Japanese reading, then whatever's first.
const PREFERRED_LOCALES = ["en", "ja-ro"];

export function pickLocalized(values: Record<string, string>): string | null {
	for (const locale of PREFERRED_LOCALES) {
		if (values[locale]) return values[locale];
	}
	return Object.values(values)[0] ?? null;
}

// The primary title isn't necessarily English (Berserk's is "ja-ro"-only),
// but an English variant often exists in altTitles instead — e.g. Berserk's
// altTitles include {en: "Berserk"} even though its main title doesn't.
// Falls back to pickLocalized's usual chain when no English title exists
// anywhere.
export function pickEnglishTitle(
	title: Record<string, string>,
	altTitles: Record<string, string>[],
): string | null {
	if (title.en) return title.en;

	const altEnglish = altTitles.find((alt) => alt.en)?.en;
	if (altEnglish) return altEnglish;

	return pickLocalized(title);
}

// Romanized Japanese title for display alongside the English one — it's
// what MangaDex itself uses as the primary title when there's no English one
// (e.g. Komi Can't Communicate's title is literally
// {"ja-ro": "Komi-san wa Komyushou Desu."}). Deliberately only considers
// "ja-ro", never raw kanji/kana ("ja") — this is meant to be readable
// without a Japanese font, not just "the native title" at any cost. A title
// can have several ja-ro candidates (e.g. multiple altTitles entries) — take
// the first one that isn't just a duplicate of the English title, rather
// than whichever happens to be listed first. Null if there's no ja-ro
// anywhere, or every one of them matches the English title.
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
