-- B3.3-B: keeps the validated B3.1 contract with the immutable processing identity.
-- This file is intentionally pending. Do not apply it to games_lucas without approval.
begin;

do $$
begin
  if exists (select 1 from public.blender_asset_processings) then
    raise exception 'B3_SOURCE_CONTRACT_BACKFILL_REQUIRED';
  end if;
end;
$$;

alter table public.blender_asset_processings
  add column source_contract jsonb;

alter table public.blender_asset_processings
  alter column source_contract set not null,
  add constraint blender_asset_processings_source_contract_object_check
    check (jsonb_typeof(source_contract) = 'object'
      and source_contract ? 'contractVersion'
      and source_contract ? 'asset'
      and source_contract ? 'source'
      and source_contract ? 'exportProfile'
      and source_contract ? 'idempotencyKey');

create or replace function public.validate_blender_asset_processing_contract()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.source_contract ->> 'contractVersion' <> '1.0.0'
    or new.source_contract -> 'asset' ->> 'assetId' <> new.asset_id
    or new.source_contract -> 'asset' ->> 'assetVersion' <> new.asset_version
    or new.source_contract -> 'source' ->> 'sha256' <> new.source_sha256
    or new.source_contract ->> 'exportProfile' <> new.profile_name
    or new.source_contract ->> 'idempotencyKey' <> new.idempotency_key::text then
    raise exception 'B3_SOURCE_CONTRACT_MISMATCH' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.source_contract is distinct from old.source_contract then
    raise exception 'B3_SOURCE_CONTRACT_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_blender_asset_processing_contract() from public, anon, authenticated;

create trigger validate_blender_asset_processing_contract
before insert or update of source_contract on public.blender_asset_processings
for each row execute function public.validate_blender_asset_processing_contract();

commit;
