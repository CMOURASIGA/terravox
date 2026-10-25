#!/usr/bin/env bash
set -euo pipefail
: "${PGPASSWORD:=postgres}"
db_url="postgresql://postgres:${PGPASSWORD}@127.0.0.1:54322/postgres"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
source_id="00000000-0000-0000-0000-000000000901"

psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
select b3_test.source('$source_id', repeat('9',64));
SQL

# Session A holds the partial unique-index key. Session B must block then fail.
( psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
begin;
select b3_test.processing('00000000-0000-0000-0000-000000000902','$source_id','00000000-0000-0000-0000-000000000903',repeat('8',64));
select pg_sleep(2);
commit;
SQL
) >"$tmp_dir/a.log" 2>&1 &
pid_a=$!
sleep 0.4
set +e
timeout 8 psql "$db_url" -v ON_ERROR_STOP=1 <<SQL >"$tmp_dir/b.log" 2>&1
set lock_timeout='5s';
select b3_test.processing('00000000-0000-0000-0000-000000000904','$source_id','00000000-0000-0000-0000-000000000905',repeat('7',64));
SQL
status_b=$?
set -e
wait "$pid_a"
test "$status_b" -ne 0
grep -Eq 'duplicate key|unique' "$tmp_dir/b.log"
echo "concurrency active-source conflict: PASS"
