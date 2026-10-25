#!/usr/bin/env bash
set -euo pipefail
: "${PGPASSWORD:=postgres}"
db_url="postgresql://postgres:${PGPASSWORD}@127.0.0.1:54322/postgres"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
source_id="00000000-0000-0000-0000-000000000901"

psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
create table if not exists b3_test.concurrency_barrier (
  name text primary key,
  ready boolean not null default false
);
select b3_test.source('$source_id', repeat('9',64));
SQL

wait_for_barrier() {
  local name="$1"
  for _ in $(seq 1 80); do
    if psql "$db_url" -Atqc "select ready from b3_test.concurrency_barrier where name = '$name'" | grep -qx t; then
      return 0
    fi
    sleep 0.1
  done
  echo "timed out waiting for barrier: $name" >&2
  return 1
}

# Session A holds the partial unique-index key.  Session B starts only after
# A has inserted the active processing, so it must block and then fail.
( psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
begin;
select b3_test.processing('00000000-0000-0000-0000-000000000902','$source_id','00000000-0000-0000-0000-000000000903',repeat('8',64));
insert into b3_test.concurrency_barrier(name,ready) values ('active-source',true)
on conflict (name) do update set ready=excluded.ready;
select pg_sleep(2);
commit;
SQL
) >"$tmp_dir/a.log" 2>&1 &
pid_a=$!
wait_for_barrier active-source
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

# Build a valid processing with all artifacts verified.  Session A locks its
# parent row before marking it completed.  Session B then attempts to mutate
# an artifact.  The trigger's FOR UPDATE must serialize the mutation behind
# completion and reject it after the terminal state is visible.
psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
select b3_test.source('00000000-0000-0000-0000-000000000920',repeat('2',64));
select b3_test.processing('00000000-0000-0000-0000-000000000921','00000000-0000-0000-0000-000000000920','00000000-0000-0000-0000-000000000922',repeat('3',64));
update public.blender_asset_processings set state='queued' where id='00000000-0000-0000-0000-000000000921';
update public.blender_asset_processings set state='processing' where id='00000000-0000-0000-0000-000000000921';
update public.blender_asset_processings set state='verifying_output' where id='00000000-0000-0000-0000-000000000921';
select b3_test.derived('00000000-0000-0000-0000-000000000930',repeat('4',64),'glb');
select b3_test.derived('00000000-0000-0000-0000-000000000931',repeat('5',64),'report');
select b3_test.derived('00000000-0000-0000-0000-000000000932',repeat('6',64),'manifest');
select b3_test.verify_artifact('00000000-0000-0000-0000-000000000921','glb','00000000-0000-0000-0000-000000000930',repeat('4',64));
select b3_test.verify_artifact('00000000-0000-0000-0000-000000000921','report','00000000-0000-0000-0000-000000000931',repeat('5',64));
select b3_test.verify_artifact('00000000-0000-0000-0000-000000000921','manifest','00000000-0000-0000-0000-000000000932',repeat('6',64));
SQL

( psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
begin;
select 1 from public.blender_asset_processings where id='00000000-0000-0000-0000-000000000921' for update;
insert into b3_test.concurrency_barrier(name,ready) values ('completion-artifact',true)
on conflict (name) do update set ready=excluded.ready;
select pg_sleep(2);
update public.blender_asset_processings set state='completed' where id='00000000-0000-0000-0000-000000000921';
commit;
SQL
) >"$tmp_dir/completion.log" 2>&1 &
pid_completion=$!
wait_for_barrier completion-artifact
set +e
timeout 8 psql "$db_url" -v ON_ERROR_STOP=1 <<SQL >"$tmp_dir/artifact.log" 2>&1
set lock_timeout='5s';
update public.blender_asset_artifacts set size_bytes=65
where processing_id='00000000-0000-0000-0000-000000000921' and kind='glb';
SQL
status_artifact=$?
set -e
wait "$pid_completion"
test "$status_artifact" -ne 0
grep -q 'B3_COMPLETED_ARTIFACT_IMMUTABLE' "$tmp_dir/artifact.log"
echo "concurrency completion/artifact serialization: PASS"
