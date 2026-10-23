-- B3.2 correction: reserve the private derived bucket for the reports,
-- manifests and thumbnails that later checkpoints will persist.
-- This does not create artifacts or grant client access to storage.objects.

update storage.buckets
set allowed_mime_types = array[
  'model/gltf-binary',
  'application/json',
  'image/png',
  'image/webp'
]
where id = 'blender-assets-derived';

alter table public.blender_asset_objects
  drop constraint blender_asset_objects_check;

alter table public.blender_asset_objects
  add constraint blender_asset_objects_storage_shape_check check (
    (bucket_id = 'blender-assets-incoming'
      and mime_type = 'application/x-blender'
      and size_bytes <= 104857600
      and storage_key ~ ('^incoming/' || environment || '/' || asset_id || '/' || asset_version || '/[a-f0-9]{64}\\.blend$'))
    or
    (bucket_id = 'blender-assets-derived'
      and mime_type = 'model/gltf-binary'
      and size_bytes <= 8388608
      and storage_key ~ ('^derived/' || environment || '/' || asset_id || '/' || asset_version || '/[0-9]+\\.[0-9]+\\.[0-9]+/[a-f0-9]{64}\\.glb$'))
    or
    (bucket_id = 'blender-assets-derived'
      and mime_type = 'application/json'
      and size_bytes <= 8388608
      and storage_key ~ ('^derived/' || environment || '/' || asset_id || '/' || asset_version || '/[0-9]+\\.[0-9]+\\.[0-9]+/[a-f0-9]{64}\\.(report|manifest)\\.json$'))
    or
    (bucket_id = 'blender-assets-derived'
      and mime_type in ('image/png', 'image/webp')
      and size_bytes <= 8388608
      and storage_key ~ ('^derived/' || environment || '/' || asset_id || '/' || asset_version || '/[0-9]+\\.[0-9]+\\.[0-9]+/[a-f0-9]{64}\\.thumb\\.(png|webp)$'))
  );
