#!/usr/bin/env bash
# Runs the migrations and the SQL tests against a throwaway local Postgres.
# Needs Postgres binaries (initdb, pg_ctl, psql) on PATH or in /usr/lib/postgresql/*/bin.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
pgbin="$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")"
tmp="$(mktemp -d)"
trap '"$pgbin/pg_ctl" -D "$tmp/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT

"$pgbin/initdb" -D "$tmp/data" -U postgres --auth=trust >/dev/null
"$pgbin/pg_ctl" -D "$tmp/data" -o "-k $tmp -c listen_addresses=''" -l "$tmp/log" start >/dev/null

psql_run() { psql -h "$tmp" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
psql_run -f "$here/supabase_stubs.sql"
for f in "$here"/../migrations/*.sql; do psql_run -f "$f"; done
for f in "$here"/*.test.sql; do
  echo "== $(basename "$f")"
  psql_run -o /dev/null -f "$f"
done
echo "All SQL tests passed."
