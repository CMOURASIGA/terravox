begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'blender_asset_processings'
  ) or not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'blender_asset_artifacts'
  ) then
    raise exception 'B3_PRECONDITION_TABLE_MISSING';
  end if;

  if exists (
    select 1
    from public.blender_asset_processings
  ) or exists (
    select 1
    from public.blender_asset_artifacts
  ) then
    raise exception 'B3_PRECONDITION_TABLES_NOT_EMPTY';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'blender_asset_processings',
        'blender_asset_artifacts'
      )
      and not t.tgisinternal
  ) then
    raise exception 'B3_PRECONDITION_TRIGGERS_ALREADY_EXIST';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class i
    join pg_catalog.pg_namespace n on n.oid = i.relnamespace
    where n.nspname = 'public'
      and i.relname = 'blender_asset_processings_one_active_source_idx'
  ) then
    raise exception 'B3_PRECONDITION_ACTIVE_SOURCE_INDEX_MISSING';
  end if;
end;
$$;

create or replace function public.validate_blender_asset_processing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_row public.blender_asset_objects%rowtype;
  job_row public.blender_jobs%rowtype;
  verified_artifacts integer;
begin
  if tg_op = 'INSERT' then
    if new.state <> 'pending_verification'
      or new.job_id is not null
      or new.started_at is not null
      or new.finished_at is not null then
      raise exception 'B3_PROCESSING_CREATE_INVALID'
        using errcode = '23514';
    end if;

    select *
      into source_row
      from public.blender_asset_objects
     where id = new.source_object_id
     for key share;

    if not found
      or source_row.bucket_id <> 'blender-assets-incoming'
      or source_row.mime_type <> 'application/x-blender'
      or source_row.state not in ('uploaded', 'verified')
      or source_row.owner_id <> new.owner_id
      or source_row.environment <> new.environment
      or source_row.asset_id <> new.asset_id
      or source_row.asset_version <> new.asset_version
      or source_row.declared_sha256 <> new.source_sha256 then
      raise exception 'B3_SOURCE_MISMATCH'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if new.source_object_id is distinct from old.source_object_id
    or new.owner_id is distinct from old.owner_id
    or new.environment is distinct from old.environment
    or new.asset_id is distinct from old.asset_id
    or new.asset_version is distinct from old.asset_version
    or new.profile_name is distinct from old.profile_name
    or new.profile_version is distinct from old.profile_version
    or new.idempotency_key is distinct from old.idempotency_key
    or new.idempotency_fingerprint is distinct from old.idempotency_fingerprint
    or new.source_sha256 is distinct from old.source_sha256
    or new.correlation_id is distinct from old.correlation_id then
    raise exception 'B3_PROCESSING_IDENTITY_IMMUTABLE'
      using errcode = '23514';
  end if;

  if old.job_id is not null
    and new.job_id is distinct from old.job_id then
    raise exception 'B3_JOB_IMMUTABLE'
      using errcode = '23514';
  end if;

  if new.job_id is not null then
    select *
      into job_row
      from public.blender_jobs
     where id = new.job_id
     for key share;

    if not found
      or job_row.operation <> 'export_glb'
      or job_row.asset_id <> new.asset_id then
      raise exception 'B3_JOB_MISMATCH'
        using errcode = '23514';
    end if;
  end if;

  if new.state is distinct from old.state and not (
    (old.state = 'pending_verification'
      and new.state in ('queued', 'failed', 'cancelled'))
    or
    (old.state = 'queued'
      and new.state in ('processing', 'failed', 'cancelled'))
    or
    (old.state = 'processing'
      and new.state in ('queued', 'verifying_output', 'failed', 'cancelled'))
    or
    (old.state = 'verifying_output'
      and new.state in ('queued', 'completed', 'failed'))
  ) then
    raise exception 'B3_PROCESSING_STATE_TRANSITION_INVALID'
      using errcode = '23514';
  end if;

  if new.state = 'completed' then
    select count(*)
      into verified_artifacts
      from public.blender_asset_artifacts
     where processing_id = new.id
       and kind in ('glb', 'report', 'manifest')
       and state = 'verified';

    if verified_artifacts <> 3 then
      raise exception 'B3_ARTIFACTS_NOT_VERIFIED'
        using errcode = '23514';
    end if;

    if new.last_error is not null then
      raise exception 'B3_COMPLETED_WITH_ERROR'
        using errcode = '23514';
    end if;
  end if;

  if new.state = 'failed' and (
    new.last_error is null
    or not (new.last_error ? 'code')
    or not (new.last_error ? 'message')
    or jsonb_typeof(new.last_error -> 'code') <> 'string'
    or jsonb_typeof(new.last_error -> 'message') <> 'string'
  ) then
    raise exception 'B3_ERROR_INVALID'
      using errcode = '23514';
  end if;

  new.updated_at := now();

  if new.state = 'processing' and old.state = 'queued' then
    new.started_at := coalesce(old.started_at, now());
  end if;

  if new.state in ('completed', 'failed', 'cancelled')
    and new.state is distinct from old.state then
    new.finished_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.validate_blender_asset_artifact()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_row public.blender_asset_processings%rowtype;
  object_row public.blender_asset_objects%rowtype;
  expected_key text;
begin
  if tg_op = 'DELETE' then
    raise exception 'B3_ARTIFACT_DELETE_FORBIDDEN'
      using errcode = '23514';
  end if;

  select *
    into parent_row
    from public.blender_asset_processings
   where id = new.processing_id
   for update;

  if not found then
    raise exception 'B3_PROCESSING_NOT_FOUND'
      using errcode = '23503';
  end if;

  if parent_row.state = 'completed' then
    raise exception 'B3_COMPLETED_ARTIFACT_IMMUTABLE'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.state <> 'planned'
      or new.storage_key is not null
      or new.content_sha256 is not null
      or new.size_bytes is not null
      or new.asset_object_id is not null
      or new.verified_at is not null then
      raise exception 'B3_ARTIFACT_CREATE_INVALID'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if new.processing_id is distinct from old.processing_id
    or new.kind is distinct from old.kind then
    raise exception 'B3_ARTIFACT_IDENTITY_IMMUTABLE'
      using errcode = '23514';
  end if;

  if new.state is distinct from old.state and not (
    (old.state = 'planned' and new.state in ('uploading', 'failed'))
    or
    (old.state = 'uploading' and new.state in ('stored', 'failed'))
    or
    (old.state = 'stored' and new.state in ('verified', 'failed'))
    or
    (old.state = 'failed' and new.state = 'planned')
  ) then
    raise exception 'B3_ARTIFACT_STATE_TRANSITION_INVALID'
      using errcode = '23514';
  end if;

  if old.state = 'verified' and (
    new.storage_key is distinct from old.storage_key
    or new.content_sha256 is distinct from old.content_sha256
    or new.size_bytes is distinct from old.size_bytes
    or new.asset_object_id is distinct from old.asset_object_id
  ) then
    raise exception 'B3_VERIFIED_ARTIFACT_IMMUTABLE'
      using errcode = '23514';
  end if;

  if new.state = 'verified' then
    if new.storage_key is null
      or new.content_sha256 is null
      or new.size_bytes is null
      or new.asset_object_id is null then
      raise exception 'B3_ARTIFACT_INCOMPLETE'
        using errcode = '23514';
    end if;

    select *
      into object_row
      from public.blender_asset_objects
     where id = new.asset_object_id
     for key share;

    if not found
      or object_row.bucket_id <> 'blender-assets-derived'
      or object_row.owner_id <> parent_row.owner_id
      or object_row.environment <> parent_row.environment
      or object_row.asset_id <> parent_row.asset_id
      or object_row.asset_version <> parent_row.asset_version
      or object_row.declared_sha256 <> new.content_sha256
      or object_row.size_bytes <> new.size_bytes
      or object_row.state not in ('processed', 'approved') then
      raise exception 'B3_ARTIFACT_OBJECT_MISMATCH'
        using errcode = '23514';
    end if;

    expected_key := 'derived/'
      || parent_row.environment || '/'
      || parent_row.asset_id || '/'
      || parent_row.asset_version || '/'
      || parent_row.profile_version || '/'
      || new.content_sha256
      || case new.kind
           when 'glb' then '.glb'
           when 'report' then '.report.json'
           when 'manifest' then '.manifest.json'
         end;

    if object_row.storage_key <> expected_key
      or new.storage_key <> expected_key
      or (
        new.kind = 'glb'
        and object_row.mime_type <> 'model/gltf-binary'
      )
      or (
        new.kind in ('report', 'manifest')
        and object_row.mime_type <> 'application/json'
      ) then
      raise exception 'B3_ARTIFACT_STORAGE_MISMATCH'
        using errcode = '23514';
    end if;

    new.verified_at := coalesce(old.verified_at, now());
    new.last_error := null;
  end if;

  if new.state = 'failed' and (
    new.last_error is null
    or not (new.last_error ? 'code')
    or not (new.last_error ? 'message')
    or jsonb_typeof(new.last_error -> 'code') <> 'string'
    or jsonb_typeof(new.last_error -> 'message') <> 'string'
  ) then
    raise exception 'B3_ERROR_INVALID'
      using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prevent_blender_asset_processing_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'B3_PROCESSING_DELETE_FORBIDDEN'
    using errcode = '23514';
end;
$$;

drop trigger if exists validate_blender_asset_processing
  on public.blender_asset_processings;

create trigger validate_blender_asset_processing
before insert or update
on public.blender_asset_processings
for each row
execute function public.validate_blender_asset_processing();

drop trigger if exists prevent_blender_asset_processing_delete
  on public.blender_asset_processings;

create trigger prevent_blender_asset_processing_delete
before delete
on public.blender_asset_processings
for each row
execute function public.prevent_blender_asset_processing_delete();

drop trigger if exists validate_blender_asset_artifact
  on public.blender_asset_artifacts;

create trigger validate_blender_asset_artifact
before insert or update or delete
on public.blender_asset_artifacts
for each row
execute function public.validate_blender_asset_artifact();

revoke all on function public.validate_blender_asset_processing()
  from public, anon, authenticated;

revoke all on function public.validate_blender_asset_artifact()
  from public, anon, authenticated;

revoke all on function public.prevent_blender_asset_processing_delete()
  from public, anon, authenticated;

commit;