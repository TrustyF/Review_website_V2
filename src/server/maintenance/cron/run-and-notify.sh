#!/bin/bash
# Usage: run-and-notify.sh <job-name> <command...>
# Wraps every host cron job (see the host's crontab) so a failure of any
# kind — a JS exception inside the job, a `docker compose run`/build
# failure, pg_dump erroring inside backup-database.sh, anything with a
# non-zero exit — creates an in-app admin notification, not just an
# uncaught-exception case inside one script's own .catch(). Also owns the
# per-job log file (cron-logs/<job-name>.log), replacing each crontab line's
# own `>> ... 2>&1` suffix. A success also gets a notification (see
# notify_cron_success) so there's a paper trail of what ran without digging
# through log files — but created already-read (see createNotification's
# markAsRead) so it doesn't bump the unread badge the way a real failure
# should.
set -uo pipefail
cd "$(dirname "$0")/../../../.."

JOB_NAME="$1"
shift

LOG_FILE="cron-logs/${JOB_NAME}.log"

{
	echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
	"$@"
} >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

# tsx (the runtime every npm script here uses) silently truncates a
# multi-line CLI argument to its first line — confirmed by reproducing it
# directly, unrelated to anything docker/cron-specific. Both messages below
# are almost always multi-line (a log tail, a markdown summary), so both go
# through base64 (-w 0: no line-wrapping, or the encoded form would hit the
# same problem) rather than as raw args; notify-admin-failure.ts/
# notify-admin-success.ts decode it back on the other end.
if [ "$EXIT_CODE" -ne 0 ]; then
	# $LOG_FILE is never rotated/truncated, and a frequent job's own output
	# can be tiny — a raw tail -c 2000 of the whole file can be dominated by
	# older, successful runs, hiding this run's (possibly output-less)
	# failure. Scope to lines from this run's own "=== timestamp ===" marker
	# onward (mirrors the SUMMARY_START/END isolation below) before tailing.
	TAIL_B64=$(awk '/^=== .* ===$/ { buf="" } { buf = buf $0 "\n" } END { printf "%s", buf }' "$LOG_FILE" | tail -c 2000 | base64 -w 0)
	sudo docker compose run --rm maintenance npm run notify_cron_failure -- "$JOB_NAME" "$TAIL_B64"
else
	# $LOG_FILE accumulates every past run's own SUMMARY_START/END block too
	# (see job-summary.ts) — awk resets `buf` on each START it sees, so by
	# EOF it only holds the most recent (this run's) block, not a previous
	# run's leftovers.
	SUMMARY_B64=$(
		awk '
			/===JOB_SUMMARY_START===/ { flag=1; buf=""; next }
			/===JOB_SUMMARY_END===/ { flag=0 }
			flag { buf = buf $0 "\n" }
			END { printf "%s", buf }
		' "$LOG_FILE" | base64 -w 0
	)
	sudo docker compose run --rm maintenance npm run notify_cron_success -- "$JOB_NAME" "$SUMMARY_B64"
fi

exit "$EXIT_CODE"
