import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import checkFile from "eslint-plugin-check-file";

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	{
		plugins: {
			"check-file": checkFile,
		},
		rules: {
			"check-file/filename-naming-convention": [
				"error",
				{
					"**/*.{jsx,tsx}": "KEBAB_CASE",
					"**/*.{js,ts}": "KEBAB_CASE",
				},
				{ ignoreMiddleExtensions: true },
			],
			"check-file/folder-naming-convention": [
				"error",
				{
					"src/**/": "NEXT_JS_APP_ROUTER_CASE",
				},
			],
			// next/link's default prefetch fires a real server-side render for
			// any dynamic route with a loading.tsx boundary the moment the link
			// scrolls into the viewport — a grid of many links can silently cost
			// dozens of invocations before anyone clicks anything (see
			// components/ui/link.tsx's own comment). Import Link from there
			// instead — same API, defaults prefetch to false.
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "next/link",
							message:
								'Import Link from "@/components/ui/link" instead of "next/link" — see that file\'s comment for why.',
						},
					],
				},
			],
		},
	},
	{
		files: ["src/components/ui/link.tsx"],
		rules: {
			"no-restricted-imports": "off",
		},
	},
	// Override default ignores of eslint-config-next.
	globalIgnores([
		// Default ignores of eslint-config-next, made recursive so nested
		// copies (e.g. inside .claude/worktrees/*) are excluded too — ESLint's
		// flat config does not read .gitignore on its own.
		"**/.next/**",
		"**/out/**",
		"**/build/**",
		"**/next-env.d.ts",
		".claude/**",
	]),
]);

export default eslintConfig;
