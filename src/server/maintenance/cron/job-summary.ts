import { appendFile } from "fs/promises";

// Sentinels run-and-notify.sh greps from the job's log file to bridge the summary into the notification, since the job and notify containers share no memory/filesystem.
const SUMMARY_START = "===JOB_SUMMARY_START===";
const SUMMARY_END = "===JOB_SUMMARY_END===";

// Appends to $GITHUB_STEP_SUMMARY (a leftover from when these ran as GitHub Actions workflows) and always logs between the sentinels for run-and-notify.sh.
export async function appendJobSummary(lines: string[]) {
	console.log(SUMMARY_START);
	console.log(lines.join("\n"));
	console.log(SUMMARY_END);

	const summaryPath = process.env.GITHUB_STEP_SUMMARY;
	if (!summaryPath) return;
	await appendFile(summaryPath, `${lines.join("\n")}\n`);
}

// Bounds a summary's file/title list so a huge run can't blow up the job summary page; full detail still goes to the console log.
export function formatSummaryList(items: string[], max = 30): string[] {
	if (items.length <= max) return items.map((i) => `- ${i}`);
	return [
		...items.slice(0, max).map((i) => `- ${i}`),
		`- …and ${items.length - max} more`,
	];
}
