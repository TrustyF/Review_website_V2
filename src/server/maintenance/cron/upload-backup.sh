#!/bin/sh
# Uploads the newest dump left in the shared /backups volume by the
# `backup_dump` ofelia job-exec (on the `db` container — see its label in
# docker-compose.yml), then removes it. /backups is transient staging, R2
# is the durable copy (see backup-database.ts's own retention logic there).
# Split into two ofelia jobs — dump on `db`, upload here on `maintenance` —
# since job-exec only ever targets one container: dumping needs pg_dump's
# own container, uploading needs this one's R2 credentials + tsx. If the
# dump job failed (or pipefail-unsafe partial output left no .sql.gz), this
# finds nothing and exits non-zero, which run-job.sh turns into an admin
# notification — covers dump failures too without needing notify plumbing
# inside the `db` container, which has no node/npm to run it with.
set -eu
cd "$(dirname "$0")/../../../.."

DUMP_FILE=$(ls -t /backups/*.sql.gz 2>/dev/null | head -1)
if [ -z "$DUMP_FILE" ]; then
	echo "No dump file found in /backups" >&2
	exit 1
fi

npm run backup_database -- "$DUMP_FILE"
rm -f "$DUMP_FILE"
