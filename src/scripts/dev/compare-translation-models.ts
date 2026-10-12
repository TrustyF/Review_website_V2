import "dotenv/config";
import { writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { claudeCostUsd } from "@/lib/claude-model";
import { db } from "@/server/db/client";
import {
	markMarkupForTranslation,
	REVIEW_TRANSLATION_SYSTEM,
	unmarkTranslatedMarkup,
} from "@/lib/i18n/review-translation";

// Side-by-side review translations across model setups, with token usage and cost.
// Usage: npm run compare_translation_models -- [sampleCount] [budgetUsd] [outPath]

const MAX_TOKENS_PER_CALL = 4000;

const OPUS = { model: "claude-opus-5-5" };
const SONNET = { model: "claude-sonnet-5-5" };
const HAIKU = { model: "claude-haiku-5-5" };

type Variant = {
	label: string;
	model: string;
	effort: "low" | "medium";
	// Typed loosely: the SDK's union doesn't include between_tools yet.
	thinking?: Record<string, unknown>;
};

const VARIANTS: Variant[] = [
	{ label: "Opus 5.5 · low (current)", ...OPUS, effort: "low" },
	{ label: "Sonnet 5.5 · low", ...SONNET, effort: "low" },
	{
		label: "Sonnet 5.5 · no thinking",
		...SONNET,
		effort: "low",
		thinking: { type: "between_tools" },
	},
	{ label: "Haiku 5.5 · low", ...HAIKU, effort: "low" },
	{
		label: "Haiku 5.5 · no thinking",
		...HAIKU,
		effort: "low",
		thinking: { type: "disabled" },
	},
];

async function main() {
	const sampleCount = Number(process.argv[2] ?? 6);
	const budgetUsd = Number(process.argv[3] ?? 1);
	const outPath = process.argv[4] ?? "translation-comparison.md";

	const reviews = (
		await db.review.findMany({
			where: { body: { not: null } },
			select: { id: true, body: true },
		})
	)
		.filter((r) => (r.body?.trim().length ?? 0) > 100)
		.sort((a, b) => (b.body?.length ?? 0) - (a.body?.length ?? 0));
	// Spread picks across the length range rather than taking only the longest.
	const step = Math.max(1, Math.floor(reviews.length / sampleCount));
	const samples = reviews
		.filter((_, i) => i % step === 0)
		.slice(0, sampleCount);

	const client = new Anthropic();
	const results = VARIANTS.map((variant) => ({
		variant,
		input: 0,
		output: 0,
		usd: 0,
		ms: 0,
		failed: 0,
	}));
	let spent = 0;
	const sections: string[] = [];

	outer: for (const [sampleIndex, review] of samples.entries()) {
		const body = review.body ?? "";
		const { marked, urls } = markMarkupForTranslation(body);
		const parts = [`## Review ${sampleIndex + 1}\n\n**English**\n\n${body}\n`];

		for (const total of results) {
			const { variant } = total;
			if (spent >= budgetUsd) {
				console.warn(`Budget of $${budgetUsd} reached, stopping.`);
				break outer;
			}
			const started = Date.now();
			let text: string;
			try {
				const response = await client.messages.create({
					model: variant.model,
					max_tokens: MAX_TOKENS_PER_CALL,
					output_config: { effort: variant.effort },
					...(variant.thinking
						? {
								thinking:
									variant.thinking as unknown as Anthropic.ThinkingConfigParam,
							}
						: {}),
					system: REVIEW_TRANSLATION_SYSTEM,
					messages: [{ role: "user", content: marked }],
				});
				const usd = claudeCostUsd(variant.model, response.usage);
				spent += usd;
				total.input += response.usage.input_tokens;
				total.output += response.usage.output_tokens;
				total.usd += usd;
				total.ms += Date.now() - started;
				const reply = response.content.find((b) => b.type === "text");
				text =
					response.stop_reason === "end_turn" && reply?.type === "text"
						? unmarkTranslatedMarkup(reply.text, urls)
						: `_(stopped: ${response.stop_reason})_`;
				if (response.stop_reason !== "end_turn") total.failed++;
				console.info(
					`review ${sampleIndex + 1} · ${variant.label}: ${response.usage.output_tokens} out, $${usd.toFixed(4)}`,
				);
			} catch (error) {
				total.failed++;
				text = `_(error: ${(error as Error).message})_`;
				console.error(`review ${sampleIndex + 1} · ${variant.label}:`, error);
			}
			parts.push(`**${variant.label}**\n\n${text}\n`);
		}
		sections.push(parts.join("\n"));
	}

	const n = samples.length;
	const table = [
		"| Setup | Avg in | Avg out | Avg $/review | $ per 1,000 reviews | Avg s | Failed |",
		"|---|---|---|---|---|---|---|",
		...results.map((t) => {
			const v = t.variant;
			return `| ${v.label} | ${Math.round(t.input / n)} | ${Math.round(t.output / n)} | ${(t.usd / n).toFixed(4)} | ${((t.usd / n) * 1000).toFixed(2)} | ${(t.ms / n / 1000).toFixed(1)} | ${t.failed} |`;
		}),
	].join("\n");

	writeFileSync(
		outPath,
		`# Translation model comparison\n\n${n} reviews, max_tokens ${MAX_TOKENS_PER_CALL}, total spent $${spent.toFixed(4)}\n\n${table}\n\n${sections.join("\n---\n\n")}`,
	);
	console.log(`\n${table}\n\nTotal $${spent.toFixed(4)} — report: ${outPath}`);
	await db.$disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
