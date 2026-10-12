import { REVIEW_MARKUP_REGEX } from "@/components/media/media-cards/media-card/review-body-syntax";
import { FRENCH_STYLE_RULES } from "@/lib/i18n/french-style";

// Shared by the review editor's translate action and the model-comparison dev script.

// Unlike review-ai-actions.ts's extractMarkup, keeps span text inline (sentinel-wrapped) so
// translation reaches it. URLs are pulled out entirely, never shown to the model.
const SPOILER_OPEN = "⟦SPOILER_OPEN⟧";
const SPOILER_CLOSE = "⟦SPOILER_CLOSE⟧";
const LINK_OPEN = "⟦LINK_OPEN⟧";
const LINK_CLOSE_PREFIX = "⟦LINK_CLOSE";
const LINK_CLOSE_REGEX = new RegExp(
	`${LINK_OPEN}([\\s\\S]*?)${LINK_CLOSE_PREFIX}(\\d+)⟧`,
	"g",
);

export function markMarkupForTranslation(body: string): {
	marked: string;
	urls: string[];
} {
	const urls: string[] = [];
	const marked = body.replace(
		REVIEW_MARKUP_REGEX,
		(_match, spoilerText, linkText, url) => {
			if (spoilerText !== undefined) {
				return `${SPOILER_OPEN}${spoilerText}${SPOILER_CLOSE}`;
			}
			const index = urls.push(url) - 1;
			return `${LINK_OPEN}${linkText}${LINK_CLOSE_PREFIX}${index}⟧`;
		},
	);
	return { marked, urls };
}

export function unmarkTranslatedMarkup(text: string, urls: string[]): string {
	const withSpoilers = text
		.replaceAll(SPOILER_OPEN, "||")
		.replaceAll(SPOILER_CLOSE, "||");
	return withSpoilers.replace(
		LINK_CLOSE_REGEX,
		(full, linkText: string, indexStr: string) => {
			const url = urls[Number(indexStr)];
			return url ? `[${linkText}](${url})` : full;
		},
	);
}

export const REVIEW_TRANSLATION_SYSTEM = `You translate review text for a personal movie/TV/manga/game log from English to French. Keep the reviewer's opinions and tone — a natural translation that reads as if written in French, not a literal one.

${FRENCH_STYLE_RULES}

The text contains marker tokens in pairs, e.g. ${SPOILER_OPEN}some phrase${SPOILER_CLOSE} or ${LINK_OPEN}some phrase${LINK_CLOSE_PREFIX}0⟧ — translate the phrase inside a pair normally, as part of the surrounding sentence, but leave the marker tokens themselves exactly as they are, immediately before/after the translated phrase: don't add, remove, rename, reorder, or explain them. Reply with only the translated text: no preamble, no explanation, no surrounding quotes.`;
