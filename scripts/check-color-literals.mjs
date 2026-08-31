// Guards against hardcoded colors creeping back into .sass files outside
// the single source of truth (globals.sass's :root token block). Run via
// `npm run lint`, which husky's pre-commit hook already invokes.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = path.resolve(import.meta.dirname, "..", "src");
const ALLOWED_FILES = new Set([
	path.join(SRC_DIR, "app", "styles", "globals.sass"),
]);
// Dev-only routes (src/app/dev/**, never shipped to real visitors) often mock
// a third-party UI (Discord, WhatsApp, ...) where the literal colors ARE the
// point — they're not part of this site's own theme and don't belong as
// design tokens.
const DEV_ROUTES_DIR = path.join(SRC_DIR, "app", "dev") + path.sep;
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
// rgb()/rgba() where r, g, b aren't all equal — i.e. an actual hue, not a
// black/white/gray shadow tuned to a one-off opacity (those are left alone;
// tokenizing every shadow alpha would just be a different flavor of noise).
const COLORED_RGB_PATTERN =
	/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,[^)]+)?\)/g;
const HSL_PATTERN = /hsla?\(/g;

function findMatches(line) {
	const matches = [
		...(line.match(HEX_PATTERN) ?? []),
		...(line.match(HSL_PATTERN) ?? []),
	];
	for (const [, r, g, b] of line.matchAll(COLORED_RGB_PATTERN)) {
		if (!(r === g && g === b)) matches.push(`rgba(${r}, ${g}, ${b}, ...)`);
	}
	return matches;
}

async function collectSassFiles(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) return collectSassFiles(fullPath);
			return entry.name.endsWith(".sass") ? [fullPath] : [];
		}),
	);
	return files.flat();
}

const sassFiles = await collectSassFiles(SRC_DIR);
const violations = [];

for (const file of sassFiles) {
	if (ALLOWED_FILES.has(file) || file.startsWith(DEV_ROUTES_DIR)) continue;
	const content = await readFile(file, "utf8");
	const lines = content.split("\n");
	lines.forEach((line, i) => {
		if (findMatches(line).length > 0)
			violations.push(
				`${path.relative(SRC_DIR, file)}:${i + 1}  ${line.trim()}`,
			);
	});
}

if (violations.length > 0) {
	console.error(
		"Hardcoded color literal(s) found outside globals.sass — use a var(--token) from :root instead:\n",
	);
	console.error(violations.join("\n"));
	console.error(
		"\nIf this color is genuinely new, add a token to src/app/styles/globals.sass's :root block and reference it with var(--token).",
	);
	process.exit(1);
}
