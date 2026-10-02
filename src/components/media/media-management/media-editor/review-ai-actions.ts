"use server";
import { requireAdmin } from "@/lib/auth/require-admin";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/claude-model";
import { REVIEW_MARKUP_REGEX } from "@/components/media/media-cards/media-card/review-body-syntax";
import { FRENCH_STYLE_RULES } from "@/lib/i18n/french-style";

// AI proofreading/translation for review bodies. Read-only: callers decide what to copy in.

const MARKUP_PLACEHOLDER_REGEX = /⟦MARKUP(\d+)⟧/g;

// Swaps every ||spoiler||/[text](url) span for a placeholder so the model never sees (and can't
// mangle) the syntax; restoreMarkup puts the spans back. Cost: text inside a span isn't proofread.
function extractMarkup(body: string): { stripped: string; spans: string[] } {
	const spans: string[] = [];
	const stripped = body.replace(REVIEW_MARKUP_REGEX, (match) => {
		const index = spans.push(match) - 1;
		return `⟦MARKUP${index}⟧`;
	});
	return { stripped, spans };
}

function restoreMarkup(text: string, spans: string[]): string {
	return text.replace(MARKUP_PLACEHOLDER_REGEX, (full, indexStr: string) => {
		return spans[Number(indexStr)] ?? full;
	});
}

// Unlike extractMarkup above, keeps span text inline (sentinel-wrapped) so
// translation reaches it. URLs are pulled out entirely, never shown to the model.
const SPOILER_OPEN = "⟦SPOILER_OPEN⟧";
const SPOILER_CLOSE = "⟦SPOILER_CLOSE⟧";
const LINK_OPEN = "⟦LINK_OPEN⟧";
const LINK_CLOSE_PREFIX = "⟦LINK_CLOSE";
const LINK_CLOSE_REGEX = new RegExp(
	`${LINK_OPEN}([\\s\\S]*?)${LINK_CLOSE_PREFIX}(\\d+)⟧`,
	"g",
);

function markMarkupForTranslation(body: string): {
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

function unmarkTranslatedMarkup(text: string, urls: string[]): string {
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

// Throws on any non-end_turn stop (max_tokens, refusal) so a truncated or refused reply is never pasted in.
async function generateText(
	systemText: string,
	content: string,
	effort: "low" | "max",
): Promise<string> {
	const client = new Anthropic();
	const response = await client.messages.create({
		model: CLAUDE_MODEL,
		// Thinking is always on and counts toward this, so leave room beyond the reply itself.
		max_tokens: 16000,
		output_config: { effort },
		// Below the ~1024-token minimum this prompt won't actually get cached
		// today, but marking it costs nothing and covers it if it ever grows.
		system: [
			{ type: "text", text: systemText, cache_control: { type: "ephemeral" } },
		],
		messages: [{ role: "user", content }],
	});
	if (response.stop_reason !== "end_turn") {
		throw new Error(`AI reply stopped early: ${response.stop_reason}`);
	}
	const textBlock = response.content.find((block) => block.type === "text");
	return textBlock?.type === "text" ? textBlock.text : "";
}

// Read-only — returns a suggested rewrite; the caller decides what to copy in.
export async function suggestReviewCorrection(body: string): Promise<string> {
	await requireAdmin();
	if (!body.trim()) return "";

	const { stripped, spans } = extractMarkup(body);

	const corrected = await generateText(
		"You proofread review text for a personal movie/TV/manga/game log. Fix grammar, spelling, clarity issues and repetitive wording. It should read like an essay. Preserve the reviewer's opinions. The text may contain placeholder tokens like ⟦MARKUP0⟧ — leave every one exactly as it is: don't add, remove, rename, translate, or explain them. Reply with only the corrected text: no preamble, no explanation, no surrounding quotes.",
		stripped,
		"low",
	);
	return restoreMarkup(corrected, spans);
}

// Read-only — suggested French translation, for the caller to copy into
// Review.bodyFr. Uses markMarkupForTranslation, not extractMarkup — see there.
export async function suggestReviewTranslation(body: string): Promise<string> {
	await requireAdmin();
	if (!body.trim()) return "";

	const { marked, urls } = markMarkupForTranslation(body);

	const translated = await generateText(
		`You translate review text for a personal movie/TV/manga/game log from English to French. Keep the reviewer's tone, opinions, and level of formality — a natural translation, not a literal one.

${FRENCH_STYLE_RULES}

The text contains marker tokens in pairs, e.g. ${SPOILER_OPEN}some phrase${SPOILER_CLOSE} or ${LINK_OPEN}some phrase${LINK_CLOSE_PREFIX}0⟧ — translate the phrase inside a pair normally, as part of the surrounding sentence, but leave the marker tokens themselves exactly as they are, immediately before/after the translated phrase: don't add, remove, rename, reorder, or explain them. Reply with only the translated text: no preamble, no explanation, no surrounding quotes.`,
		marked,
		"max",
	);
	return unmarkTranslatedMarkup(translated, urls);
}
