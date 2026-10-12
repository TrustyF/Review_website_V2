"use server";
import { requireAdmin } from "@/lib/auth/require-admin";
import Anthropic from "@anthropic-ai/sdk";
import {
	CLAUDE_PROOFREAD_MODEL,
	claudeCostUsd,
	TRANSLATION_MODELS,
	type TranslationModelId,
} from "@/lib/claude-model";
import { REVIEW_MARKUP_REGEX } from "@/components/media/media-cards/media-card/review-body-syntax";
import {
	markMarkupForTranslation,
	REVIEW_TRANSLATION_SYSTEM,
	unmarkTranslatedMarkup,
} from "@/lib/i18n/review-translation";

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

// Throws on any non-end_turn stop (max_tokens, refusal) so a truncated or refused reply is never pasted in.
async function generateText(
	model: string,
	systemText: string,
	content: string,
): Promise<{ text: string; costUsd: number }> {
	const client = new Anthropic();
	const response = await client.messages.create({
		model,
		// Thinking is always on and counts toward this, so leave room beyond the reply itself.
		max_tokens: 16000,
		// Low on both: thinking is billed as output, and neither task gains much from more.
		output_config: { effort: "low" },
		// Below the ~1024-token minimum this prompt won't actually get cached
		// today, but marking it costs nothing and covers it if it ever grows.
		system: [
			{ type: "text", text: systemText, cache_control: { type: "ephemeral" } },
		],
		messages: [{ role: "user", content }],
	});
	console.info(`[review-ai] ${model}`, response.usage);
	if (response.stop_reason !== "end_turn") {
		throw new Error(`AI reply stopped early: ${response.stop_reason}`);
	}
	const textBlock = response.content.find((block) => block.type === "text");
	return {
		text: textBlock?.type === "text" ? textBlock.text : "",
		costUsd: claudeCostUsd(model, response.usage),
	};
}

// Read-only — returns a suggested rewrite; the caller decides what to copy in.
export async function suggestReviewCorrection(body: string): Promise<string> {
	await requireAdmin();
	if (!body.trim()) return "";

	const { stripped, spans } = extractMarkup(body);

	const { text: corrected } = await generateText(
		CLAUDE_PROOFREAD_MODEL,
		"You proofread review text for a personal movie/TV/manga/game log. Fix grammar, spelling, clarity issues and repetitive wording. It should read like an essay. Preserve the reviewer's opinions. Keep every line break and paragraph break exactly where it is: don't merge or split paragraphs. The text may contain placeholder tokens like ⟦MARKUP0⟧ — leave every one exactly as it is: don't add, remove, rename, translate, or explain them. Reply with only the corrected text: no preamble, no explanation, no surrounding quotes.",
		stripped,
	);
	return restoreMarkup(corrected, spans);
}

// Read-only — suggested French translation, for the caller to copy into
// Review.bodyFr. Uses markMarkupForTranslation, not extractMarkup — see there.
export async function suggestReviewTranslation(
	body: string,
	model: TranslationModelId,
): Promise<{ text: string; costUsd: number }> {
	await requireAdmin();
	if (!body.trim()) return { text: "", costUsd: 0 };
	// Server actions take any client input, so only allow the listed models.
	if (!TRANSLATION_MODELS.some((option) => option.id === model)) {
		throw new Error(`Unsupported translation model: ${model}`);
	}

	const { marked, urls } = markMarkupForTranslation(body);

	const { text, costUsd } = await generateText(
		model,
		REVIEW_TRANSLATION_SYSTEM,
		marked,
	);
	return { text: unmarkTranslatedMarkup(text, urls), costUsd };
}
