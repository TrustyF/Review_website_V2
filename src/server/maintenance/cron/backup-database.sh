#!/bin/bash
# Invoked by the host's crontab (see the self-hosting migration plan) —
# replaces the old backup-database.yml GitHub Actions workflow, which dumped
# Neon over the network. Dumps the local `db` service directly instead, then
# hands the file to backup-database.ts (via the `maintenance` service) for
# upload + grandfather-father-son pruning in R2, same as before. The dump
# file only lives in ./backups transiently — R2 is the durable copy.
#
# No --rm on the maintenance run: leaving the exited container around lets
# Dozzle show this run's logs. A separate crontab entry prunes exited
# `maintenance` containers past a retention window so they don't pile up
# forever.
set -euo pipefail
cd "$(dirname "$0")/../../../.."

TIMESTAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
DUMP_FILE="backups/${TIMESTAMP}.sql.gz"

POSTGRES_USER=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
POSTGRES_DB=$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)

trap 'rm -f "$DUMP_FILE"' EXIT

sudo docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DUMP_FILE"
sudo docker compose run maintenance npm run backup_database -- "$DUMP_FILE"
