-- B3.2 reconciliation: these client policies were recreated outside the repository.
-- Asset metadata remains server-side until B3.4.
drop policy if exists blender_asset_objects_select_own_environment
on public.blender_asset_objects;

drop policy if exists blender_asset_objects_insert_own_environment
on public.blender_asset_objects;

drop policy if exists blender_asset_objects_update_own_environment
on public.blender_asset_objects;
