# B3.2 external RLS migration reconciliation

## Historical record

The remote Supabase history contains `20261022170001_optimize_blender_asset_rls`, created outside this repository by `contactconsultservices@gmail.com`.

Its remote SQL recreated these client policies on `public.blender_asset_objects`:

- `blender_asset_objects_select_own_environment`
- `blender_asset_objects_insert_own_environment`
- `blender_asset_objects_update_own_environment`

The remote history is retained as audit evidence. It is not reverted, removed, or replayed.

## Local reconstruction strategy

`20261022170001_reconcile_external_blender_asset_rls_history.sql` intentionally does not reproduce the remote `CREATE POLICY` statements. The B3.2 baseline already creates those policies for a clean database. The reconciliation migration only verifies that the expected historical state exists before the approved lockdown migration runs.

The ordered clean reconstruction is:

1. `20261021192826_create_blender_asset_storage` creates the private buckets, asset registry and initial policies.
2. `20261022150855_allow_blender_derived_artifacts` expands only derived artifact validation.
3. `20261022170001_reconcile_external_blender_asset_rls_history` validates the historical pre-lockdown policies without mutating them.
4. `20261022181500_lock_down_blender_asset_object_client_writes` revokes client access and removes the policies.
5. `20261022190000_remove_recreated_blender_asset_client_policies` is an idempotent compensating migration for the externally recreated policies.

The final state has no client policy on `blender_asset_objects`, keeps RLS enabled, and does not touch educational tables, asset records, or storage bucket visibility.

## Reproducibility evidence

`tests/migration.test.ts` verifies that the historical reconciliation migration performs no policy creation, policy removal, grants, revokes, Storage mutations, or educational-table mutation. It also verifies that both approved lockdown migrations remove all three client policies after the historical guard.
