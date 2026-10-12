// Pinned on purpose: new versions can change API behavior, so bump them deliberately.
// Translations (review bodies + i18n script) — where voice matters most.
export const CLAUDE_MODEL = "claude-opus-5-5";
// Review proofreading — grammar fixes don't need Opus, and Haiku is ~40x cheaper.
export const CLAUDE_PROOFREAD_MODEL = "claude-haiku-5-5";

// $ per 1M tokens.
const PRICES: Record<string, { input: number; output: number }> = {
	"claude-opus-5-5": { input: 4, output: 20 },
	"claude-sonnet-5-5": { input: 2, output: 10 },
	"claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

// Review translation choices, all at low effort; the first is the default.
export const TRANSLATION_MODELS = [
	{ id: "claude-opus-5-5", label: "Opus 5.5" },
	{ id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
	{ id: "claude-haiku-5-5", label: "Haiku 5.5" },
] as const;
export type TranslationModelId = (typeof TRANSLATION_MODELS)[number]["id"];

type Usage = {
	input_tokens: number;
	output_tokens: number;
	cache_creation_input_tokens?: number | null;
	cache_read_input_tokens?: number | null;
};

// Cache writes bill at 1.25x input, reads at 0.1x.
export function claudeCostUsd(model: string, usage: Usage): number {
	const price = PRICES[model];
	if (!price) return 0;
	const input =
		usage.input_tokens +
		(usage.cache_creation_input_tokens ?? 0) * 1.25 +
		(usage.cache_read_input_tokens ?? 0) * 0.1;
	return (input * price.input + usage.output_tokens * price.output) / 1_000_000;
}
