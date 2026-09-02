import { notFound } from "next/navigation";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import styles from "./logs.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

const MAX_VISIBLE_RUNS = 100;

// Paper trail of host-crontab jobs (see run-and-notify.sh) — one row per
// CronJobRun, most-recent-first. Replaces the old CRON_JOB_FAILED/
// CRON_JOB_SUCCEEDED notifications.
export default async function AdminLogsPage() {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") notFound();

	const runs = await db.cronJobRun.findMany({
		orderBy: { createdAt: "desc" },
		take: MAX_VISIBLE_RUNS,
	});

	return (
		<div className={styles.wrapper}>
			<h1>Cron job logs</h1>

			{runs.length === 0 ? (
				<p className={styles.empty}>No cron jobs have run yet.</p>
			) : (
				<ul className={styles.list}>
					{runs.map((run) => {
						const failed = run.status === "FAILURE";
						const Icon = failed ? TriangleAlert : CircleCheck;
						return (
							<li
								key={run.id}
								className={`${styles.row} ${failed ? styles.failed : styles.succeeded}`}>
								<Icon size={16} className={styles.icon} />
								<div className={styles.content}>
									<div className={styles.title_row}>
										<span className={styles.job_name}>{run.jobName}</span>
										<span className={styles.date}>
											{DateFormatter.format(run.createdAt)}
										</span>
									</div>
									{run.summary && <div className={styles.summary}>{run.summary}</div>}
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
