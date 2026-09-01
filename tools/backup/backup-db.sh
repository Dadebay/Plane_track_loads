#!/bin/sh
# Runs one Postgres backup and prunes backups older than RETENTION_DAYS.
# Faz 15 task 3: daily automated backup, 30-day retention.
#
# Required env: PGHOST, PGUSER, PGPASSWORD, PGDATABASE.
# Optional env: BACKUP_DIR (default /backups), RETENTION_DAYS (default 30).
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_DIR}/tua_load_control_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "{\"time\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"info\",\"msg\":\"backup starting\",\"dest\":\"${DEST}\"}"

pg_dump --no-owner --no-privileges | gzip > "${DEST}.tmp"
mv "${DEST}.tmp" "${DEST}"

echo "{\"time\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"info\",\"msg\":\"backup complete\",\"dest\":\"${DEST}\",\"bytes\":$(wc -c < "${DEST}")}"

# Prune backups older than RETENTION_DAYS.
find "${BACKUP_DIR}" -name 'tua_load_control_*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete | \
  while read -r pruned; do
    echo "{\"time\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"info\",\"msg\":\"backup pruned\",\"file\":\"${pruned}\"}"
  done
