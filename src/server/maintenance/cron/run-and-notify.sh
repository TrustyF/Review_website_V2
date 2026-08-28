#!/bin/bash
# Usage: run-and-notify.sh <job-name> <command...>
# Wraps every host cron job (see the host's crontab) so a failure of any
# kind — a JS exception inside the job, a `docker compose run`/build
# failure, pg_dump erroring inside backup-database.sh, anything with a
# non-zero exit — creates an in-app admin notification, not just an
# uncaught-exception case inside one script's own .catch(). Also owns the
# per-job log file (cron-logs/<job-name>.log), replacing each crontab line's
# own `>> ... 2>&1` suffix.
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

if [ "$EXIT_CODE" -ne 0 ]; then
	TAIL=$(tail -c 2000 "$LOG_FILE")
	sudo docker compose run --rm maintenance npm run notify_cron_failure -- "$JOB_NAME" "$TAIL"
fi

exit "$EXIT_CODE"
