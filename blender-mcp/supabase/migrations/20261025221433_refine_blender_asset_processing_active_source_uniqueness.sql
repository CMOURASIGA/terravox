alter table public.blender_asset_processings drop constraint blender_asset_processings_source_object_id_key;
create unique index blender_asset_processings_one_active_source_idx on public.blender_asset_processings (source_object_id) where state in ('pending_verification','queued','processing','verifying_output');
