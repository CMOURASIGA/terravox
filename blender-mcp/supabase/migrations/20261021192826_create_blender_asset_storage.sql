-- B3.2 baseline. This migration was first applied to games_lucas on 2026-10-21.
-- It is retained here so the repository is the source of truth for the schema.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('blender-assets-incoming', 'blender-assets-incoming', false, 104857600, array['application/x-blender']),
  ('blender-assets-derived', 'blender-assets-derived', false, 8388608, array['model/gltf-binary'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.blender_asset_objects (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null check (asset_id ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  asset_version text not null check (asset_version ~ '^v[0-9]{3}$'),
  environment text not null check (environment in ('homologation', 'preview', 'production')),
  owner_id uuid not null,
  requested_by_id uuid not null,
  bucket_id text not null check (bucket_id in ('blender-assets-incoming', 'blender-assets-derived')),
  storage_key text not null,
  declared_sha256 text not null check (declared_sha256 ~ '^[a-f0-9]{64}$'),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  state text not null default 'pending_upload' check (state in (
    'pending_upload', 'uploaded', 'verified', 'processed', 'failed', 'approved', 'expired', 'deleted'
  )),
  referenced_by_game boolean not null default false,
  correlation_id uuid not null,
  audit_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(audit_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uploaded_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  unique (bucket_id, storage_key),
  check (position('..' in storage_key) = 0),
  check (position('\\' in storage_key) = 0),
  check (storage_key !~ '^/' and storage_key !~ '://'),
  check (
    (bucket_id = 'blender-assets-incoming'
      and mime_type = 'application/x-blender'
      and size_bytes <= 104857600
      and storage_key ~ ('^incoming/' || environment || '/' || asset_id || '/' || asset_version || '/[a-f0-9]{64}\\.blend$'))
    or
    (bucket_id = 'blender-assets-derived'
      and mime_type = 'model/gltf-binary'
      and size_bytes <= 8388608
      and storage_key ~ ('^derived/' || environment || '/' || asset_id || '/' || asset_version || '/[0-9]+\\.[0-9]+\\.[0-9]+/[a-f0-9]{64}\\.glb$'))
  ),
  check (
    referenced_by_game = false
    or (bucket_id = 'blender-assets-derived' and state = 'approved' and expires_at is null)
  )
);

create index blender_asset_objects_owner_environment_idx
  on public.blender_asset_objects (owner_id, environment, created_at desc);
create index blender_asset_objects_expiry_idx
  on public.blender_asset_objects (expires_at)
  where expires_at is not null and referenced_by_game = false and state <> 'deleted';

alter table public.blender_asset_objects enable row level security;
revoke all on table public.blender_asset_objects from public, anon;
grant select, insert, update on table public.blender_asset_objects to authenticated;
grant select, insert, update, delete on table public.blender_asset_objects to service_role;

create policy blender_asset_objects_select_own_environment
on public.blender_asset_objects for select to authenticated
using (
  ((select auth.uid()) = owner_id or (select auth.uid()) = requested_by_id)
  and coalesce((select auth.jwt() -> 'app_metadata' -> 'terravox_asset_environments'), '[]'::jsonb) ? environment
);

create policy blender_asset_objects_insert_own_environment
on public.blender_asset_objects for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and (select auth.uid()) = requested_by_id
  and coalesce((select auth.jwt() -> 'app_metadata' -> 'terravox_asset_environments'), '[]'::jsonb) ? environment
);

create policy blender_asset_objects_update_own_environment
on public.blender_asset_objects for update to authenticated
using (
  ((select auth.uid()) = owner_id or (select auth.uid()) = requested_by_id)
  and coalesce((select auth.jwt() -> 'app_metadata' -> 'terravox_asset_environments'), '[]'::jsonb) ? environment
)
with check (
  ((select auth.uid()) = owner_id or (select auth.uid()) = requested_by_id)
  and coalesce((select auth.jwt() -> 'app_metadata' -> 'terravox_asset_environments'), '[]'::jsonb) ? environment
);
