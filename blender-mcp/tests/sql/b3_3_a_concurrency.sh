#!/usr/bin/env bash
set -euo pipefail

: "${PGPASSWORD:=postgres}"
db_url="postgresql://postgres:${PGPASSWORD}@127.0.0.1:54322/postgres"
tmp_dir="$(mktemp -d)"
declare -a child_pids=()

cleanup() {
  local pid
  for pid in "${child_pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM

wait_for_file() {
  local path="$1"
  for _ in $(seq 1 100); do
    [[ -f "$path" ]] && return 0
    sleep 0.05
  done
  echo "timed out waiting for signal: $path" >&2
  return 1
}

wait_for_backend_lock() {
  local pid_file="$1" pid
  wait_for_file "$pid_file"
  pid="$(tr -d '[:space:]' < "$pid_file")"
  [[ "$pid" =~ ^[0-9]+$ ]] || { echo "invalid backend pid" >&2; return 1; }
  for _ in $(seq 1 100); do
    if psql "$db_url" -Atqc "select state = 'active' and wait_event_type = 'Lock' from pg_stat_activity where pid = $pid" | grep -qx t; then
      return 0
    fi
    sleep 0.05
  done
  echo "second session never waited on a lock: backend $pid" >&2
  return 1
}

require_running() {
  local pid="$1" label="$2"
  kill -0 "$pid" 2>/dev/null || { echo "$label ended before release" >&2; return 1; }
}

run_active_source_conflict() {
  local ready="$tmp_dir/active-a.ready" release="$tmp_dir/active-a.release"
  local b_pid_file="$tmp_dir/active-b.backend" a_pid b_pid status_b

  psql "$db_url" -v ON_ERROR_STOP=1 -c "select b3_test.source('00000000-0000-0000-0000-000000000901', repeat('9',64));"
  (
    psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
begin;
select b3_test.processing('00000000-0000-0000-0000-000000000902','00000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000903',repeat('8',64));
\\! touch '$ready'
\\! while [ ! -f '$release' ]; do sleep 0.05; done
commit;
SQL
  ) >"$tmp_dir/active-a.log" 2>&1 &
  a_pid=$!; child_pids+=("$a_pid")
  wait_for_file "$ready"
  require_running "$a_pid" "active-source session A"

  (
    psql "$db_url" -Atq -v ON_ERROR_STOP=1 <<SQL
\\o '$b_pid_file'
select pg_backend_pid();
\\o
select b3_test.processing('00000000-0000-0000-0000-000000000904','00000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000905',repeat('7',64));
SQL
  ) >"$tmp_dir/active-b.log" 2>&1 &
  b_pid=$!; child_pids+=("$b_pid")
  wait_for_backend_lock "$b_pid_file"
  require_running "$a_pid" "active-source session A"
  require_running "$b_pid" "active-source session B"

  touch "$release"
  wait "$a_pid"
  set +e
  wait "$b_pid"; status_b=$?
  set -e
  [[ "$status_b" -ne 0 ]] || { echo "active-source conflict unexpectedly succeeded" >&2; return 1; }
  grep -Eq 'duplicate key|unique' "$tmp_dir/active-b.log" || { cat "$tmp_dir/active-b.log" >&2; return 1; }
  ! grep -Eqi 'lock timeout|statement timeout' "$tmp_dir/active-b.log" || { cat "$tmp_dir/active-b.log" >&2; return 1; }
  echo "concurrency active-source conflict: PASS"
}

run_completion_artifact_race() {
  local ready="$tmp_dir/completion-a.ready" release="$tmp_dir/completion-a.release"
  local b_pid_file="$tmp_dir/completion-b.backend" a_pid b_pid status_b

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
  (
    psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
begin;
select 1 from public.blender_asset_processings where id='00000000-0000-0000-0000-000000000921' for update;
\\! touch '$ready'
\\! while [ ! -f '$release' ]; do sleep 0.05; done
update public.blender_asset_processings set state='completed' where id='00000000-0000-0000-0000-000000000921';
commit;
SQL
  ) >"$tmp_dir/completion-a.log" 2>&1 &
  a_pid=$!; child_pids+=("$a_pid")
  wait_for_file "$ready"
  require_running "$a_pid" "completion session A"

  (
    psql "$db_url" -Atq -v ON_ERROR_STOP=1 <<SQL
\\o '$b_pid_file'
select pg_backend_pid();
\\o
update public.blender_asset_artifacts set size_bytes=65 where processing_id='00000000-0000-0000-0000-000000000921' and kind='glb';
SQL
  ) >"$tmp_dir/completion-b.log" 2>&1 &
  b_pid=$!; child_pids+=("$b_pid")
  wait_for_backend_lock "$b_pid_file"
  require_running "$a_pid" "completion session A"
  require_running "$b_pid" "completion session B"

  touch "$release"
  wait "$a_pid"
  set +e
  wait "$b_pid"; status_b=$?
  set -e
  [[ "$status_b" -ne 0 ]] || { echo "artifact mutation unexpectedly succeeded" >&2; return 1; }
  grep -q 'B3_COMPLETED_ARTIFACT_IMMUTABLE' "$tmp_dir/completion-b.log" || { cat "$tmp_dir/completion-b.log" >&2; return 1; }
  ! grep -Eqi 'lock timeout|statement timeout' "$tmp_dir/completion-b.log" || { cat "$tmp_dir/completion-b.log" >&2; return 1; }
  echo "concurrency completion/artifact serialization: PASS"
}

run_active_source_conflict
run_completion_artifact_race
