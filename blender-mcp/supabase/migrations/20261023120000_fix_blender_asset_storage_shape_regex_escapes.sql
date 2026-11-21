-- B3.2 correction: PostgreSQL standard-conforming string literals preserve a
-- backslash. The original constraint used two backslashes before each dot,
-- which makes the regex expect a literal backslash followed by any character.
-- Use one backslash before each dot so the regex matches the literal dot in
-- canonical object extensions.
--
-- This migration changes only the storage-key shape constraint. It does not
-- alter RLS, grants, buckets, rows, or Storage policies.

alter table public.blender_asset_objects
  drop constraint if exists blender_asset_objects_storage_shape_check;

alter table public.blender_asset_objects
  add constraint blender_asset_objects_storage_shape_check check (
    (bucket_id = 'blender-assets-incoming'
      and mime_type = 'application/x-blender'
      and size_bytes <= 104857600
      and storage_key ~ ('^incoming/' || environment || '/' || asset_id || '/' || asset_version || '/[a-f0-9]{64}\.blend$'))
    or
    (bucket_id = 'blender-assets-derived'
      and mime_type = 'model/gltf-binary'
      and size_bytes <= 8388608
      and storage_key ~ ('^derived/' || environment || '/' || asset_id || '/' || asset_version || '/[0-9]+\.[0-9]+\.[0-9]+/[a-f0-9]{64}\.glb$'))
    or
    (bucket_id = 'blender-assets-derived'
      and mime_type = 'application/json'
      and size_bytes <= 8388608
      and storage_key ~ ('^derived/' || environment || '/' || asset_id || '/' || asset_version || '/[0-9]+\.[0-9]+\.[0-9]+/[a-f0-9]{64}\.(report|manifest)\.json$'))
    or
    (bucket_id = 'blender-assets-derived'
      and mime_type in ('image/png', 'image/webp')
      and size_bytes <= 8388608
      and storage_key ~ ('^derived/' || environment || '/' || asset_id || '/' || asset_version || '/[0-9]+\.[0-9]+\.[0-9]+/[a-f0-9]{64}\.thumb\.(png|webp)$'))
  );
