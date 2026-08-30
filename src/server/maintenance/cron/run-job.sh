#!/bin/sh
# Usage: run-job.sh <job-name> <command...>
# Invoked by ofelia's job-exec labels (see docker-compose.yml's `maintenance`
# service) inside the long-lived `maintenance` container — replaces the old
# host-side run-and-notify.sh now that the schedule itself lives in ofelia
# labels instead of the host crontab. No longer owns a log file: `docker
# exec` output is captured by ofelia's own logs, and since this container
# stays running (rather than the old ad hoc `docker compose run --rm` per
# job), Dozzle can show each run too. This only adds the in-app admin
# notification on failure.
set -u
JOB_NAME="$1"
shift
"$@"
EXIT_CODE=$?
if [ "$EXIT_CODE" -ne 0 ]; then
	npm run notify_cron_failure -- "$JOB_NAME" "job failed with exit code $EXIT_CODE — see ofelia/dozzle logs"
fi
exit "$EXIT_CODE"
