create table public.blender_asset_processings (
  id uuid primary key default gen_random_uuid(), source_object_id uuid not null unique references public.blender_asset_objects(id), job_id uuid unique references public.blender_jobs(id), owner_id uuid not null,
  environment text not null check (environment in ('homologation','preview','production')), asset_id text not null check (asset_id ~ '^[a-z0-9][a-z0-9-]{2,63}$'), asset_version text not null check (asset_version ~ '^v[0-9]{3}$'),
  profile_name text not null check (profile_name = 'terravox-web-default'), profile_version text not null check (profile_version = '1.0.0'), idempotency_key uuid not null,
  idempotency_fingerprint text not null check (idempotency_fingerprint ~ '^[a-f0-9]{64}$'), source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending_verification' check (state in ('pending_verification','queued','processing','verifying_output','completed','failed','cancelled')), correlation_id uuid not null,
  last_error jsonb check (last_error is null or jsonb_typeof(last_error) = 'object'), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz,
  unique (owner_id, environment, idempotency_key), unique (owner_id, environment, idempotency_fingerprint)
);
create index blender_asset_processings_recovery_idx on public.blender_asset_processings (state, updated_at, id) where state in ('pending_verification','queued','processing','verifying_output');
create index blender_asset_processings_source_idx on public.blender_asset_processings (source_sha256, asset_id, asset_version);
create table public.blender_asset_artifacts (
  id uuid primary key default gen_random_uuid(), processing_id uuid not null references public.blender_asset_processings(id), kind text not null check (kind in ('glb','report','manifest')),
  state text not null default 'planned' check (state in ('planned','uploading','stored','verified','failed')), storage_key text, content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'), size_bytes bigint check (size_bytes is null or size_bytes > 0), asset_object_id uuid unique references public.blender_asset_objects(id),
  last_error jsonb check (last_error is null or jsonb_typeof(last_error) = 'object'), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), verified_at timestamptz, unique (processing_id, kind)
);
create index blender_asset_artifacts_recovery_idx on public.blender_asset_artifacts (state, updated_at, id) where state in ('planned','uploading','stored');
alter table public.blender_asset_processings enable row level security;
alter table public.blender_asset_artifacts enable row level security;
revoke all on table public.blender_asset_processings from public, anon, authenticated;
revoke all on table public.blender_asset_artifacts from public, anon, authenticated;
grant select, insert, update, delete on table public.blender_asset_processings to service_role;
grant select, insert, update, delete on table public.blender_asset_artifacts to service_role;
