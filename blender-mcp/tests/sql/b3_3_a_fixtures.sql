create schema if not exists b3_test;
create or replace function b3_test.assert_true(condition boolean, message text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'ASSERTION_FAILED: %', message; end if; end $$;
create or replace function b3_test.assert_raises(statement text, expected text) returns void language plpgsql as $$
declare did_fail boolean := false; actual text;
begin
  begin execute statement;
  exception when others then did_fail := true; actual := sqlerrm;
  end;
  if not did_fail then raise exception 'ASSERTION_DID_NOT_FAIL'; end if;
  if position(expected in actual) = 0 then
    raise exception 'ASSERTION_WRONG_ERROR: expected %, got %', expected, actual;
  end if;
end $$;
create or replace function b3_test.source(p_id uuid, p_hash text default repeat('a',64)) returns uuid language plpgsql as $$
begin
 insert into public.blender_asset_objects(id,asset_id,asset_version,environment,owner_id,requested_by_id,bucket_id,storage_key,declared_sha256,mime_type,size_bytes,state,correlation_id)
 values(p_id,'asset-v001','v001','homologation','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','blender-assets-incoming','incoming/homologation/asset-v001/v001/'||p_hash||'.blend',p_hash,'application/x-blender',64,'uploaded','00000000-0000-0000-0000-000000000010');
 return p_id;
end $$;
create or replace function b3_test.processing(p_id uuid, p_source uuid, p_key uuid, p_fingerprint text) returns uuid language plpgsql as $$
begin
 insert into public.blender_asset_processings(id,source_object_id,owner_id,environment,asset_id,asset_version,profile_name,profile_version,idempotency_key,idempotency_fingerprint,source_sha256,correlation_id)
 select p_id,p_source,owner_id,environment,asset_id,asset_version,'terravox-web-default','1.0.0',p_key,p_fingerprint,declared_sha256,'00000000-0000-0000-0000-000000000020' from public.blender_asset_objects where id=p_source;
 return p_id;
end $$;
create or replace function b3_test.derived(p_id uuid, p_hash text, p_kind text) returns uuid language plpgsql as $$
declare suffix text; mime text;
begin
 suffix:=case p_kind when 'glb' then '.glb' when 'report' then '.report.json' else '.manifest.json' end;
 mime:=case when p_kind='glb' then 'model/gltf-binary' else 'application/json' end;
 insert into public.blender_asset_objects(id,asset_id,asset_version,environment,owner_id,requested_by_id,bucket_id,storage_key,declared_sha256,mime_type,size_bytes,state,correlation_id)
 values(p_id,'asset-v001','v001','homologation','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','blender-assets-derived','derived/homologation/asset-v001/v001/1.0.0/'||p_hash||suffix,p_hash,mime,64,'processed','00000000-0000-0000-0000-000000000030');
 return p_id;
end $$;
create or replace function b3_test.verify_artifact(p_processing uuid,p_kind text,p_object uuid,p_hash text) returns void language plpgsql as $$
declare key text;
begin
 key:='derived/homologation/asset-v001/v001/1.0.0/'||p_hash||case p_kind when 'glb' then '.glb' when 'report' then '.report.json' else '.manifest.json' end;
 insert into public.blender_asset_artifacts(processing_id,kind) values(p_processing,p_kind);
 update public.blender_asset_artifacts set state='uploading' where processing_id=p_processing and kind=p_kind;
 update public.blender_asset_artifacts set state='stored' where processing_id=p_processing and kind=p_kind;
 update public.blender_asset_artifacts set state='verified',asset_object_id=p_object,storage_key=key,content_sha256=p_hash,size_bytes=64 where processing_id=p_processing and kind=p_kind;
end $$;
