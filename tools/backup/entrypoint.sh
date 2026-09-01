#!/bin/sh
# Runs backup-db.sh once immediately, then once daily at BACKUP_HOUR_UTC.
# No cron daemon: a plain sleep loop is simpler to read and debug in a
# single-purpose container, and "once a day, roughly on time" is all a
# 30-day-retention backup needs.
set -eu

BACKUP_HOUR_UTC="${BACKUP_HOUR_UTC:-03}"

# Pure arithmetic, no `date -d` parsing — BusyBox's date on alpine only
# supports a subset of GNU date's -d syntax, so this stays portable.
seconds_until_next_run() {
  now_sec_of_day=$(( 10#$(date -u +%H) * 3600 + 10#$(date -u +%M) * 60 + 10#$(date -u +%S) ))
  target_sec_of_day=$(( 10#${BACKUP_HOUR_UTC} * 3600 ))
  if [ "${now_sec_of_day}" -lt "${target_sec_of_day}" ]; then
    echo $((target_sec_of_day - now_sec_of_day))
  else
    echo $((86400 - now_sec_of_day + target_sec_of_day))
  fi
}

/backup-db.sh

while true; do
  wait_seconds="$(seconds_until_next_run)"
  echo "{\"time\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"info\",\"msg\":\"next backup scheduled\",\"waitSeconds\":${wait_seconds}}"
  sleep "${wait_seconds}"
  /backup-db.sh
done
