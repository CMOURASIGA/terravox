-- Historical reconciliation for the externally recorded remote migration
-- 20261022170001_optimize_blender_asset_rls. Its original DDL recreated
-- client policies outside this repository and must never be executed again.
--
-- This guard preserves the remote migration version in the local sequence,
-- validates the expected pre-lockdown state during a clean reconstruction,
-- and deliberately performs no policy, grant, bucket, table or data mutation.
do $$
declare
  historical_policy_count integer;
begin
  select count(*)
  into historical_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'blender_asset_objects'
    and policyname in (
      'blender_asset_objects_select_own_environment',
      'blender_asset_objects_insert_own_environment',
      'blender_asset_objects_update_own_environment'
    );

  if historical_policy_count <> 3 then
    raise exception
      'expected three historical client policies before B3.2 lockdown, found %',
      historical_policy_count;
  end if;
end;
$$;
