import "dotenv/config";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import Anthropic from "@anthropic-ai/sdk";
import { FRENCH_STYLE_RULES } from "@/lib/i18n/french-style";
import { CLAUDE_MODEL } from "@/lib/claude-model";

// Sole writer of fr.ts, so every French string goes through FRENCH_STYLE_RULES (usage in CLAUDE.md).
// fr.lock.json records which English each French entry was translated from.

const EN_PATH = "src/lib/i18n/dictionaries/en.ts";
const FR_PATH = "src/lib/i18n/dictionaries/fr.ts";
const LOCK_PATH = "src/lib/i18n/dictionaries/fr.lock.json";
const CHUNK_SIZE = 60;

type Lock = Record<string, { en: string; fr: string }>;

// Whitespace and trailing commas collapsed so reformatting alone doesn't count as an edit.
function fingerprint(source: string): string {
	const normalized = source
		.replace(/\s+/g, " ")
		.replace(/,\s*([)\]}])/g, "$1")
		.trim();
	return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function parseDictionary(path: string, exportName: string) {
	const sf = ts.createSourceFile(
		path,
		readFileSync(path, "utf8"),
		ts.ScriptTarget.Latest,
		true,
	);
	let root: ts.ObjectLiteralExpression | undefined;
	sf.forEachChild((node) => {
		if (!ts.isVariableStatement(node)) return;
		for (const decl of node.declarationList.declarations) {
			if (decl.name.getText(sf) !== exportName || !decl.initializer) continue;
			let init: ts.Expression = decl.initializer;
			if (ts.isSatisfiesExpression(init)) init = init.expression;
			if (ts.isObjectLiteralExpression(init)) root = init;
		}
	});
	if (!root) throw new Error(`No \`${exportName}\` object literal in ${path}`);

	const leaves = new Map<string, string>();
	function walk(obj: ts.ObjectLiteralExpression, prefix: string) {
		for (const prop of obj.properties) {
			if (!ts.isPropertyAssignment(prop)) {
				throw new Error(`Unsupported property in ${path}: ${prop.getText(sf)}`);
			}
			const key = prefix + prop.name.getText(sf).replace(/^["']|["']$/g, "");
			if (ts.isObjectLiteralExpression(prop.initializer)) {
				walk(prop.initializer, `${key}.`);
			} else {
				leaves.set(key, prop.initializer.getText(sf));
			}
		}
	}
	walk(root, "");
	return { sf, root, leaves };
}

// Mirrors en.ts's shape and key order, with each leaf swapped for its French source.
function renderFr(
	enSf: ts.SourceFile,
	enRoot: ts.ObjectLiteralExpression,
	fr: Map<string, string>,
): string {
	function render(obj: ts.ObjectLiteralExpression, prefix: string): string {
		return obj.properties
			.map((prop) => {
				if (!ts.isPropertyAssignment(prop)) return "";
				const name = prop.name.getText(enSf);
				const key = prefix + name.replace(/^["']|["']$/g, "");
				if (ts.isObjectLiteralExpression(prop.initializer)) {
					return `${name}: {\n${render(prop.initializer, `${key}.`)}},\n`;
				}
				const value = fr.get(key);
				if (value === undefined) throw new Error(`No French for ${key}`);
				return `${name}: ${value},\n`;
			})
			.join("");
	}
	return `// Written by \`npm run i18n:fr\` from en.ts — don't edit by hand, see CLAUDE.md.
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

export const fr = {
${render(enRoot, "")}} satisfies Dictionary;
`;
}

function readLock(): Lock {
	return existsSync(LOCK_PATH)
		? (JSON.parse(readFileSync(LOCK_PATH, "utf8")) as Lock)
		: {};
}

function writeLock(lock: Lock) {
	const sorted = Object.fromEntries(
		Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)),
	);
	writeFileSync(LOCK_PATH, `${JSON.stringify(sorted, null, "\t")}\n`);
}

function findProblems(
	en: Map<string, string>,
	fr: Map<string, string>,
	lock: Lock,
) {
	const stale: string[] = [];
	const handEdited: string[] = [];
	for (const [key, enSource] of en) {
		const entry = lock[key];
		const frSource = fr.get(key);
		if (
			!entry ||
			entry.en !== fingerprint(enSource) ||
			frSource === undefined
		) {
			stale.push(key);
		} else if (entry.fr !== fingerprint(frSource)) {
			handEdited.push(key);
		}
	}
	// Left behind when an English entry is deleted.
	const removed = [...fr.keys()].filter((key) => !en.has(key));
	return { stale, handEdited, removed };
}

// Syntax errors only; fr.ts's `satisfies Dictionary` catches type mismatches at typecheck.
function syntaxErrors(expression: string): string | null {
	const { diagnostics } = ts.transpileModule(`const x = ${expression};`, {
		reportDiagnostics: true,
		compilerOptions: { target: ts.ScriptTarget.Latest },
	});
	if (!diagnostics?.length) return null;
	return diagnostics
		.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
		.join("; ");
}

function isArrowFunction(expression: string): boolean {
	const sf = ts.createSourceFile(
		"x.ts",
		`const x = ${expression};`,
		ts.ScriptTarget.Latest,
	);
	const statement = sf.statements[0];
	const init =
		statement && ts.isVariableStatement(statement)
			? statement.declarationList.declarations[0]?.initializer
			: undefined;
	return init !== undefined && ts.isArrowFunction(init);
}

function systemPrompt(enSource: string, frSource: string | null): string {
	return `You translate the UI strings of arthur's corner, a personal website where Arthur logs and reviews the movies, TV, books, manga, comics and games they've gotten through. Visitors can browse that library, keep a watchlist, make lists, and ask Arthur for recommendations.

You get a JSON object mapping dictionary keys (dot paths, e.g. "nav.movies" or "account.settingsAriaLabel" — they tell you where the text appears) to TypeScript expressions taken from the English dictionary. Return the French TypeScript expression for every key:
- A string literal stays a double-quoted string literal, escaped as needed.
- An arrow function keeps exactly the same parameters, type annotations and logic. Translate only the user-visible text, and adjust grammatical agreement (gender, plural endings) where French needs it. Keep every \${...} interpolation as is.
- Keep the brand name "arthur's corner" / "Arthur's Corner" as written, and translate aria labels and tooltips like any other text.

${FRENCH_STYLE_RULES}

The full English dictionary, for context on where each string is used:

\`\`\`ts
${enSource}
\`\`\`${
		frSource
			? `

The current French dictionary, for consistency with the wording already in use:

\`\`\`ts
${frSource}
\`\`\``
			: ""
	}`;
}

const OUTPUT_SCHEMA = {
	type: "object",
	properties: {
		translations: {
			type: "array",
			items: {
				type: "object",
				properties: { key: { type: "string" }, source: { type: "string" } },
				required: ["key", "source"],
				additionalProperties: false,
			},
		},
	},
	required: ["translations"],
	additionalProperties: false,
};

async function translateChunk(
	client: Anthropic,
	system: string,
	chunk: [string, string][],
): Promise<Map<string, string>> {
	const message = await client.beta.messages
		.stream({
			model: CLAUDE_MODEL,
			max_tokens: 64000,
			betas: ["server-side-fallback-2026-07-01"],
			fallbacks: "default",
			output_config: {
				effort: "high",
				format: { type: "json_schema", schema: OUTPUT_SCHEMA },
			},
			system: [
				{ type: "text", text: system, cache_control: { type: "ephemeral" } },
			],
			messages: [
				{
					role: "user",
					content: JSON.stringify(Object.fromEntries(chunk), null, 2),
				},
			],
		})
		.finalMessage();

	if (message.stop_reason !== "end_turn") {
		throw new Error(`Translation stopped early: ${message.stop_reason}`);
	}
	const text = message.content.find((block) => block.type === "text");
	if (!text || text.type !== "text") throw new Error("No text in response");
	const { translations } = JSON.parse(text.text) as {
		translations: { key: string; source: string }[];
	};

	const result = new Map<string, string>();
	for (const [key, enSource] of chunk) {
		const found = translations.find((t) => t.key === key);
		if (!found) throw new Error(`Missing translation for ${key}`);
		const error = syntaxErrors(found.source);
		if (error)
			throw new Error(`Invalid source for ${key}: ${error}\n${found.source}`);
		if (isArrowFunction(enSource) !== isArrowFunction(found.source)) {
			throw new Error(`Kind mismatch for ${key}: ${found.source}`);
		}
		result.set(key, found.source);
	}
	return result;
}

function listArg(args: string[], flag: string): string[] {
	const i = args.indexOf(flag);
	if (i === -1) return [];
	const value = args[i + 1];
	if (!value) throw new Error(`${flag} needs a comma-separated list of keys`);
	return value.split(",").map((k) => k.trim());
}

function check() {
	const en = parseDictionary(EN_PATH, "en").leaves;
	const fr = parseDictionary(FR_PATH, "fr").leaves;
	const { stale, handEdited, removed } = findProblems(en, fr, readLock());
	if (stale.length === 0 && handEdited.length === 0 && removed.length === 0) {
		console.log("fr.ts is up to date with en.ts.");
		return;
	}
	if (stale.length) {
		console.error(
			`English changed without retranslating:\n  ${stale.join("\n  ")}`,
		);
		console.error("Run `npm run i18n:fr`.");
	}
	if (removed.length) {
		console.error(
			`Removed from en.ts but still in fr.ts:\n  ${removed.join("\n  ")}`,
		);
		console.error("Run `npm run i18n:fr`.");
	}
	if (handEdited.length) {
		console.error(`French edited by hand:\n  ${handEdited.join("\n  ")}`);
		console.error(
			"Retranslate with `npm run i18n:fr -- --keys <keys>`, or keep the edit with `npm run i18n:fr -- --accept <keys>`.",
		);
	}
	process.exit(1);
}

async function translate(args: string[]) {
	const enParsed = parseDictionary(EN_PATH, "en");
	const en = enParsed.leaves;
	const fr = parseDictionary(FR_PATH, "fr").leaves;
	const lock = readLock();
	const all = args.includes("--all");
	const forced = listArg(args, "--keys");
	const accepted = listArg(args, "--accept");
	for (const key of [...forced, ...accepted]) {
		if (!en.has(key)) throw new Error(`Unknown key: ${key}`);
	}

	const { stale, handEdited, removed } = findProblems(en, fr, lock);
	const todo = all ? [...en.keys()] : [...new Set([...stale, ...forced])];

	if (todo.length) {
		console.log(
			`Translating ${todo.length} entr${todo.length === 1 ? "y" : "ies"} with ${CLAUDE_MODEL}…`,
		);
		const client = new Anthropic();
		// Retranslating everything shouldn't anchor on the wording it's replacing.
		const system = systemPrompt(
			readFileSync(EN_PATH, "utf8"),
			all ? null : readFileSync(FR_PATH, "utf8"),
		);
		const chunks: [string, string][][] = [];
		for (let i = 0; i < todo.length; i += CHUNK_SIZE) {
			chunks.push(
				todo.slice(i, i + CHUNK_SIZE).map((k) => [k, en.get(k) ?? ""]),
			);
		}
		const results = await Promise.all(
			chunks.map((chunk) => translateChunk(client, system, chunk)),
		);
		for (const result of results) {
			for (const [key, source] of result) fr.set(key, source);
		}
	}
	// renderFr follows en.ts's shape, so rewriting also drops removed entries.
	if (todo.length || removed.length) {
		writeFileSync(FR_PATH, renderFr(enParsed.sf, enParsed.root, fr));
		execSync(`npx biome format --write ${FR_PATH}`, { stdio: "ignore" });
	}

	// Fingerprint the formatted file, which is what i18n:check will read.
	const written = parseDictionary(FR_PATH, "fr").leaves;
	for (const key of [...todo, ...accepted]) {
		lock[key] = {
			en: fingerprint(en.get(key) ?? ""),
			fr: fingerprint(written.get(key) ?? ""),
		};
	}
	for (const key of Object.keys(lock)) if (!en.has(key)) delete lock[key];
	writeLock(lock);

	const stillEdited = handEdited.filter(
		(k) => !todo.includes(k) && !accepted.includes(k),
	);
	console.log(
		`Done: ${todo.length} translated, ${removed.length} removed, ${accepted.length} accepted.${
			stillEdited.length
				? `\nStill hand-edited (use --keys or --accept): ${stillEdited.join(", ")}`
				: ""
		}`,
	);
}

const args = process.argv.slice(2);
if (args[0] === "check") {
	check();
} else {
	translate(args).catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
