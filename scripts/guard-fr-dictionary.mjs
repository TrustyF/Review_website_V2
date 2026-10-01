// Claude Code PreToolUse hook: blocks direct writes to fr.ts so every French
// string goes through `npm run i18n:fr`. Exit code 2 rejects the tool call.
let input = "";
for await (const chunk of process.stdin) input += chunk;
const { tool_name: tool, tool_input: params = {} } = JSON.parse(input);

const FR = /dictionaries[\\/]+fr\.(ts|lock\.json)\b/;
const WRITES =
	/sed\s+-i|perl\s+-\S*i|\btee\b|python|node\s+-e|Set-Content|Add-Content|Out-File|>\s*["']?\S*fr\.(ts|lock\.json)|\b(cp|mv|Copy-Item|Move-Item)\b/;

const blocked =
	((tool === "Edit" || tool === "Write" || tool === "MultiEdit") &&
		FR.test(params.file_path ?? "")) ||
	((tool === "Bash" || tool === "PowerShell") &&
		FR.test(params.command ?? "") &&
		WRITES.test(params.command ?? ""));

if (blocked) {
	console.error(
		"fr.ts and fr.lock.json are written only by `npm run i18n:fr`. Change en.ts, then run `npm run i18n:fr` (or `-- --keys <keys>` to retranslate specific entries).",
	);
	process.exit(2);
}
