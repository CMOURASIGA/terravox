\set ON_ERROR_STOP on
\ir b3_3_a_fixtures.sql

-- Security is tested per table, role and operation, including PUBLIC inheritance.
select b3_test.assert_true(not has_table_privilege('public','public.blender_asset_processings','select,insert,update,delete'),'PUBLIC processings CRUD');
select b3_test.assert_true(not has_table_privilege('public','public.blender_asset_artifacts','select,insert,update,delete'),'PUBLIC artifacts CRUD');
select b3_test.assert_true(not has_table_privilege('anon','public.blender_asset_processings','select') and not has_table_privilege('anon','public.blender_asset_processings','insert') and not has_table_privilege('anon','public.blender_asset_processings','update') and not has_table_privilege('anon','public.blender_asset_processings','delete'),'anon processing CRUD');
select b3_test.assert_true(not has_table_privilege('anon','public.blender_asset_artifacts','select') and not has_table_privilege('anon','public.blender_asset_artifacts','insert') and not has_table_privilege('anon','public.blender_asset_artifacts','update') and not has_table_privilege('anon','public.blender_asset_artifacts','delete'),'anon artifact CRUD');
select b3_test.assert_true(not has_table_privilege('authenticated','public.blender_asset_processings','select,insert,update,delete'),'authenticated processings CRUD');
select b3_test.assert_true(not has_table_privilege('authenticated','public.blender_asset_artifacts','select,insert,update,delete'),'authenticated artifacts CRUD');
select b3_test.assert_true(has_table_privilege('service_role','public.blender_asset_processings','select,insert,update,delete'),'service processings CRUD');
select b3_test.assert_true(has_table_privilege('service_role','public.blender_asset_artifacts','select,insert,update,delete'),'service artifacts CRUD');
select b3_test.assert_true((select count(*)=0 from pg_policies where schemaname='public' and tablename in ('blender_asset_processings','blender_asset_artifacts')),'no policies');
select b3_test.assert_true((select count(*)=3 from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and c.relname in ('blender_asset_processings','blender_asset_artifacts')),'three triggers');
select b3_test.assert_true(not has_function_privilege('anon','public.validate_blender_asset_processing()','execute') and not has_function_privilege('authenticated','public.validate_blender_asset_artifact()','execute'),'trigger functions private');

-- Valid lifecycle with GLB, report and manifest, then terminal immutability.
select b3_test.source('00000000-0000-0000-0000-000000000101');
select b3_test.processing('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301',repeat('b',64));
update public.blender_asset_processings set state='queued' where id='00000000-0000-0000-0000-000000000201';
update public.blender_asset_processings set state='processing' where id='00000000-0000-0000-0000-000000000201';
update public.blender_asset_processings set state='verifying_output' where id='00000000-0000-0000-0000-000000000201';
select b3_test.assert_raises($q$update public.blender_asset_processings set state='completed' where id='00000000-0000-0000-0000-000000000201'$q$,'B3_ARTIFACTS_NOT_VERIFIED');
select b3_test.derived('00000000-0000-0000-0000-000000000401',repeat('c',64),'glb');
select b3_test.derived('00000000-0000-0000-0000-000000000402',repeat('d',64),'report');
select b3_test.derived('00000000-0000-0000-0000-000000000403',repeat('e',64),'manifest');
select b3_test.verify_artifact('00000000-0000-0000-0000-000000000201','glb','00000000-0000-0000-0000-000000000401',repeat('c',64));
select b3_test.verify_artifact('00000000-0000-0000-0000-000000000201','report','00000000-0000-0000-0000-000000000402',repeat('d',64));
select b3_test.verify_artifact('00000000-0000-0000-0000-000000000201','manifest','00000000-0000-0000-0000-000000000403',repeat('e',64));
update public.blender_asset_processings set state='completed' where id='00000000-0000-0000-0000-000000000201';
select b3_test.assert_true((select state='completed' from public.blender_asset_processings where id='00000000-0000-0000-0000-000000000201'),'complete with all artifacts');
select b3_test.assert_raises($q$delete from public.blender_asset_artifacts where processing_id='00000000-0000-0000-0000-000000000201' and kind='glb'$q$,'B3_ARTIFACT_DELETE_FORBIDDEN');
select b3_test.assert_raises($q$update public.blender_asset_artifacts set size_bytes=65 where processing_id='00000000-0000-0000-0000-000000000201' and kind='glb'$q$,'B3_COMPLETED_ARTIFACT_IMMUTABLE');

-- Idempotency, active-source conflict, immutable identity and terminal reprocessing.
select b3_test.assert_raises($q$select b3_test.processing('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301',repeat('f',64))$q$,'duplicate key');
select b3_test.processing('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000303',repeat('f',64));
select b3_test.assert_true(exists(select 1 from public.blender_asset_processings where id='00000000-0000-0000-0000-000000000203'),'reprocess after completed');
select b3_test.assert_raises($q$update public.blender_asset_processings set owner_id='00000000-0000-0000-0000-000000000099' where id='00000000-0000-0000-0000-000000000203'$q$,'B3_PROCESSING_IDENTITY_IMMUTABLE');
select b3_test.assert_raises($q$delete from public.blender_asset_processings where id='00000000-0000-0000-0000-000000000203'$q$,'B3_PROCESSING_DELETE_FORBIDDEN');
