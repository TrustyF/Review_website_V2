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
// Same shape as links; the pair wraps the alt text, which may be empty.
const IMAGE_OPEN = "⟦IMAGE_OPEN⟧";
const IMAGE_CLOSE_PREFIX = "⟦IMAGE_CLOSE";
const IMAGE_CLOSE_REGEX = new RegExp(
	`${IMAGE_OPEN}([\\s\\S]*?)${IMAGE_CLOSE_PREFIX}(\\d+)⟧`,
	"g",
);

// Standalone token for markup restored verbatim (spacers); its index points into `urls` too.
const KEEP_PREFIX = "⟦KEEP";
const KEEP_REGEX = new RegExp(`${KEEP_PREFIX}(\\d+)⟧`, "g");

export function markMarkupForTranslation(body: string): {
	marked: string;
	urls: string[];
} {
	const urls: string[] = [];
	const marked = body.replace(
		REVIEW_MARKUP_REGEX,
		(
			match,
			spoilerText,
			imageAlt,
			imageUrl,
			imageSize,
			linkText,
			linkUrl,
			spacer,
		) => {
			if (spoilerText !== undefined) {
				return `${SPOILER_OPEN}${spoilerText}${SPOILER_CLOSE}`;
			}
			if (imageUrl !== undefined) {
				// The size rides along with the URL, so it's restored untouched.
				const target = imageSize ? `${imageUrl} =${imageSize}` : imageUrl;
				const index = urls.push(target) - 1;
				return `${IMAGE_OPEN}${imageAlt}${IMAGE_CLOSE_PREFIX}${index}⟧`;
			}
			if (spacer !== undefined) {
				// Nothing to translate; an opaque token keeps "spacer" from becoming French.
				const index = urls.push(match) - 1;
				return `${KEEP_PREFIX}${index}⟧`;
			}
			const index = urls.push(linkUrl) - 1;
			return `${LINK_OPEN}${linkText}${LINK_CLOSE_PREFIX}${index}⟧`;
		},
	);
	return { marked, urls };
}

export function unmarkTranslatedMarkup(text: string, urls: string[]): string {
	const withSpoilers = text
		.replaceAll(SPOILER_OPEN, "||")
		.replaceAll(SPOILER_CLOSE, "||")
		.replace(
			KEEP_REGEX,
			(full, indexStr: string) => urls[Number(indexStr)] ?? full,
		);
	const withImages = withSpoilers.replace(
		IMAGE_CLOSE_REGEX,
		(full, alt: string, indexStr: string) => {
			const url = urls[Number(indexStr)];
			return url ? `![${alt}](${url})` : full;
		},
	);
	return withImages.replace(
		LINK_CLOSE_REGEX,
		(full, linkText: string, indexStr: string) => {
			const url = urls[Number(indexStr)];
			return url ? `[${linkText}](${url})` : full;
		},
	);
}

export const REVIEW_TRANSLATION_SYSTEM = `You translate review text for a personal movie/TV/manga/game log from English to French. Keep the reviewer's opinions and tone — a natural translation that reads as if written in French, not a literal one.

${FRENCH_STYLE_RULES}

The text contains marker tokens in pairs, e.g. ${SPOILER_OPEN}some phrase${SPOILER_CLOSE} or ${LINK_OPEN}some phrase${LINK_CLOSE_PREFIX}0⟧ or ${IMAGE_OPEN}some phrase${IMAGE_CLOSE_PREFIX}1⟧ (the phrase may be empty) — translate the phrase inside a pair normally, as part of the surrounding sentence, but leave the marker tokens themselves exactly as they are, immediately before/after the translated phrase: don't add, remove, rename, reorder, or explain them. Standalone tokens like ${KEEP_PREFIX}2⟧ stand for layout and must stay exactly where they are. Reply with only the translated text: no preamble, no explanation, no surrounding quotes.`;
