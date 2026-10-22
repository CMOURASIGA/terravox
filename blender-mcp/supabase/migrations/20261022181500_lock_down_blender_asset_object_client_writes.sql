-- B3.2 security complement: asset metadata is exclusively server-side until B3.4.
-- Authenticated clients must not create, modify, or enumerate privileged asset metadata.
revoke select, insert, update on table public.blender_asset_objects from authenticated;

drop policy if exists blender_asset_objects_select_own_environment on public.blender_asset_objects;
drop policy if exists blender_asset_objects_insert_own_environment on public.blender_asset_objects;
drop policy if exists blender_asset_objects_update_own_environment on public.blender_asset_objects;