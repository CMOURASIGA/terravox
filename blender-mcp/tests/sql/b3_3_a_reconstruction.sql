\set ON_ERROR_STOP on

create schema if not exists b3_test;
create or replace function b3_test.assert_true(condition boolean, message text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'ASSERTION_FAILED: %', message; end if; end $$;
create or replace function b3_test.assert_fails(sql_text text, expected text) returns void language plpgsql as $$
begin
  begin execute sql_text; raise exception 'ASSERTION_DID_NOT_FAIL: %', expected;
  exception when others then
    if position(expected in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- Structural reconstruction: migrations, RLS, constraints, grants and trigger set.
select b3_test.assert_true(to_regclass('public.blender_asset_processings') is not null, 'processings table');
select b3_test.assert_true(to_regclass('public.blender_asset_artifacts') is not null, 'artifacts table');
select b3_test.assert_true((select relrowsecurity from pg_class where oid='public.blender_asset_processings'::regclass), 'processing RLS');
select b3_test.assert_true((select relrowsecurity from pg_class where oid='public.blender_asset_artifacts'::regclass), 'artifact RLS');
select b3_test.assert_true(not exists (select 1 from pg_constraint where conrelid='public.blender_asset_processings'::regclass and conname='blender_asset_processings_source_object_id_key'), 'global source uniqueness removed');
select b3_test.assert_true(exists (select 1 from pg_class where relname='blender_asset_processings_one_active_source_idx'), 'active source index');
select b3_test.assert_true((select count(*)=3 from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname in ('blender_asset_processings','blender_asset_artifacts') and not t.tgisinternal), 'three integrity triggers');
select b3_test.assert_true(not has_table_privilege('anon','public.blender_asset_processings','select,insert,update,delete'), 'anon no CRUD');
select b3_test.assert_true(not has_table_privilege('authenticated','public.blender_asset_artifacts','select,insert,update,delete'), 'authenticated no CRUD');
select b3_test.assert_true(has_table_privilege('service_role','public.blender_asset_processings','select,insert,update,delete'), 'service role CRUD');

-- Synthetic source fixture. IDs and hashes are scoped to this disposable database.
insert into public.blender_asset_objects
  (id, owner_id, environment, asset_id, asset_version, bucket_id, storage_key, declared_sha256, mime_type, size_bytes, state)
values
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','homologation','asset-v001','v001','blender-assets-incoming','incoming/homologation/asset-v001/v001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.blend','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','application/x-blender',1,'uploaded');

insert into public.blender_asset_processings
  (id,source_object_id,owner_id,environment,asset_id,asset_version,profile_name,profile_version,idempotency_key,idempotency_fingerprint,source_sha256,correlation_id)
values
  ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','homologation','asset-v001','v001','terravox-web-default','1.0.0','00000000-0000-0000-0000-000000000301',repeat('b',64),repeat('a',64),'00000000-0000-0000-0000-000000000401');

-- Active-source conflict, immutable identity, invalid state and mandatory artifacts.
select b3_test.assert_fails($q$insert into public.blender_asset_processings (source_object_id,owner_id,environment,asset_id,asset_version,profile_name,profile_version,idempotency_key,idempotency_fingerprint,source_sha256,correlation_id) values ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','homologation','asset-v001','v001','terravox-web-default','1.0.0','00000000-0000-0000-0000-000000000302',repeat('c',64),repeat('a',64),'00000000-0000-0000-0000-000000000402')$q$, 'duplicate key');
select b3_test.assert_fails($q$update public.blender_asset_processings set owner_id='00000000-0000-0000-0000-000000000099' where id='00000000-0000-0000-0000-000000000201'$q$, 'B3_PROCESSING_IDENTITY_IMMUTABLE');
select b3_test.assert_fails($q$update public.blender_asset_processings set state='completed' where id='00000000-0000-0000-0000-000000000201'$q$, 'B3_PROCESSING_STATE_TRANSITION_INVALID');
update public.blender_asset_processings set state='queued' where id='00000000-0000-0000-0000-000000000201';
update public.blender_asset_processings set state='processing' where id='00000000-0000-0000-0000-000000000201';
update public.blender_asset_processings set state='verifying_output' where id='00000000-0000-0000-0000-000000000201';
select b3_test.assert_fails($q$update public.blender_asset_processings set state='completed' where id='00000000-0000-0000-0000-000000000201'$q$, 'B3_ARTIFACTS_NOT_VERIFIED');
select b3_test.assert_fails($q$delete from public.blender_asset_processings where id='00000000-0000-0000-0000-000000000201'$q$, 'B3_PROCESSING_DELETE_FORBIDDEN');

drop schema b3_test cascade;
