import { appendFile } from "fs/promises";

// Appends markdown to $GITHUB_STEP_SUMMARY — the report rendered on a
// workflow run's page — so every scheduled maintenance script's cron run
// shows what it actually did without digging through logs. A no-op outside
// CI, since that env var only ever exists there.
export async function appendJobSummary(lines: string[]) {
	const summaryPath = process.env.GITHUB_STEP_SUMMARY;
	if (!summaryPath) return;
	await appendFile(summaryPath, `${lines.join("\n")}\n`);
}

// Bounds a summary's file/title list so one huge run (e.g. a bulk cleanup
// after a migration) can't blow up the job summary page — full detail still
// goes to the console log either way.
export function formatSummaryList(items: string[], max = 30): string[] {
	if (items.length <= max) return items.map((i) => `- ${i}`);
	return [
		...items.slice(0, max).map((i) => `- ${i}`),
		`- …and ${items.length - max} more`,
	];
}
