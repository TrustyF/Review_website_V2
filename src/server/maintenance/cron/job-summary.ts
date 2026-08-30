import { appendFile } from "fs/promises";

// Sentinel lines run-and-notify.sh greps out of a job's captured stdout
// (cron-logs/<job-name>.log) to pull the summary back out into the
// CRON_JOB_SUCCEEDED notification's message — the job run and the
// notify_cron_success call are two separate `docker compose run --rm`
// containers with no shared memory/filesystem, so the log file (the one
// thing both ever touch, even indirectly) is what bridges them. Unlikely
// enough to collide with real script output that no escaping is attempted.
const SUMMARY_START = "===JOB_SUMMARY_START===";
const SUMMARY_END = "===JOB_SUMMARY_END===";

// Appends markdown to $GITHUB_STEP_SUMMARY — the report rendered on a
// GitHub Actions workflow run's page, back when these ran as workflows
// instead of cron jobs — and unconditionally logs the same lines between
// SUMMARY_START/SUMMARY_END so run-and-notify.sh can surface them in an
// admin notification even now that nothing sets GITHUB_STEP_SUMMARY.
export async function appendJobSummary(lines: string[]) {
	console.log(SUMMARY_START);
	console.log(lines.join("\n"));
	console.log(SUMMARY_END);

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
