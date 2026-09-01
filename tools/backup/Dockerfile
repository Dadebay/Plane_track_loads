# Standalone backup sidecar for compose.prod.yaml — pg_dump on a daily
# schedule, 30-day retention (Faz 15 task 3). postgres:16-alpine already
# ships the matching pg_dump client version, so no separate client install.
FROM postgres:16-alpine

COPY backup-db.sh /backup-db.sh
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /backup-db.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
