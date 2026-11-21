import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../supabase/migrations/20260922155748_create_blender_jobs.sql",
  import.meta.url,
);
const assetStorageMigrationUrl = new URL(
  "../supabase/migrations/20261021192826_create_blender_asset_storage.sql",
  import.meta.url,
);
const derivedArtifactsMigrationUrl = new URL(
  "../supabase/migrations/20261022150855_allow_blender_derived_artifacts.sql",
  import.meta.url,
);
const rlsLockdownMigrationUrl = new URL(
  "../supabase/migrations/20261022181500_lock_down_blender_asset_object_client_writes.sql",
  import.meta.url,
);
const externalRlsHistoryMigrationUrl = new URL(
  "../supabase/migrations/20261022170001_reconcile_external_blender_asset_rls_history.sql",
  import.meta.url,
);
const reconciledClientPoliciesMigrationUrl = new URL(
  "../supabase/migrations/20261022190000_remove_recreated_blender_asset_client_policies.sql",
  import.meta.url,
);
const storageShapeRegexFixMigrationUrl = new URL(
  "../supabase/migrations/20261023120000_fix_blender_asset_storage_shape_regex_escapes.sql",
  import.meta.url,
);

const incomingBlendKeyPattern = /^incoming\/homologation\/asset-v001\/v001\/[a-f0-9]{64}\.blend$/;
const derivedGlbKeyPattern = /^derived\/homologation\/asset-v001\/v001\/1\.0\.0\/[a-f0-9]{64}\.glb$/;

describe("B1 database migration", () => {
  it("enforces RLS, transition validation and an atomic claim", async () => {
    const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();
    expect(sql).toContain("alter table public.blender_jobs enable row level security");
    expect(sql).toContain("revoke all on table public.blender_jobs from public, anon, authenticated");
    expect(sql).toContain("create trigger validate_blender_job_transition");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("update public.blender_jobs as job");
    expect(sql).toContain("lease_expires_at");
    expect(sql).toContain("grant execute on function public.claim_blender_job");
  });
});

describe("B3.2 asset storage migrations", () => {
  it("keeps Blender buckets private and the asset registry under RLS", async () => {
    const sql = (await readFile(assetStorageMigrationUrl, "utf8")).toLowerCase();
    expect(sql).toContain("'blender-assets-incoming'");
    expect(sql).toContain("'blender-assets-derived'");
    expect(sql).toContain("false, 104857600");
    expect(sql).toContain("alter table public.blender_asset_objects enable row level security");
    expect(sql).toContain("app_metadata");
    expect(sql).not.toContain("user_metadata");
    expect(sql).toContain("revoke all on table public.blender_asset_objects from public, anon");
  });

  it("does not block private future report, manifest or thumbnail artifacts", async () => {
    const sql = (await readFile(derivedArtifactsMigrationUrl, "utf8")).toLowerCase();
    expect(sql).toContain("'application/json'");
    expect(sql).toContain("'image/png'");
    expect(sql).toContain("report|manifest");
    expect(sql).toContain(".thumb");
  });

  it("reserves registry mutation and enumeration to server-side roles", async () => {
    const sql = (await readFile(rlsLockdownMigrationUrl, "utf8")).toLowerCase();
    expect(sql).toContain("revoke select, insert, update on table public.blender_asset_objects from authenticated");
    expect(sql).toContain("drop policy if exists blender_asset_objects_select_own_environment");
    expect(sql).toContain("drop policy if exists blender_asset_objects_insert_own_environment");
    expect(sql).toContain("drop policy if exists blender_asset_objects_update_own_environment");
  });

  it("records the external RLS history without recreating client policies", async () => {
    const sql = (await readFile(externalRlsHistoryMigrationUrl, "utf8")).toLowerCase();
    expect(sql).toContain("from pg_policies");
    expect(sql).toContain("expected three historical client policies");
    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("drop policy");
    expect(sql).not.toContain("grant ");
    expect(sql).not.toContain("revoke ");
    expect(sql).not.toContain("learning_content");
    expect(sql).not.toContain("questions");
  });

  it("removes only the client policies recreated outside the repository", async () => {
    const sql = (await readFile(reconciledClientPoliciesMigrationUrl, "utf8")).toLowerCase();
    expect(sql).toContain("drop policy if exists blender_asset_objects_select_own_environment");
    expect(sql).toContain("drop policy if exists blender_asset_objects_insert_own_environment");
    expect(sql).toContain("drop policy if exists blender_asset_objects_update_own_environment");
    expect(sql).not.toContain("grant ");
    expect(sql).not.toContain("revoke ");
    expect(sql).not.toContain("storage.buckets");
  });

  it("reconstructs the locked-down final policy state in migration order", async () => {
    const [externalHistory, lockdown, reconciliation] = await Promise.all([
      readFile(externalRlsHistoryMigrationUrl, "utf8"),
      readFile(rlsLockdownMigrationUrl, "utf8"),
      readFile(reconciledClientPoliciesMigrationUrl, "utf8"),
    ]);

    expect(externalHistory).not.toContain("create policy");
    for (const policy of [
      "blender_asset_objects_select_own_environment",
      "blender_asset_objects_insert_own_environment",
      "blender_asset_objects_update_own_environment",
    ]) {
      expect(lockdown).toContain(`drop policy if exists ${policy}`);
      expect(reconciliation).toContain(`drop policy if exists ${policy}`);
    }
  });

  it("fixes PostgreSQL regex escaping without changing storage access controls", async () => {
    const sql = (await readFile(storageShapeRegexFixMigrationUrl, "utf8")).toLowerCase();

    expect(sql).toContain("drop constraint if exists blender_asset_objects_storage_shape_check");
    expect(sql).toContain("add constraint blender_asset_objects_storage_shape_check check");
    expect(sql).toContain("bucket_id = 'blender-assets-incoming'");
    expect(sql).toContain("bucket_id = 'blender-assets-derived'");
    expect(sql).toContain("mime_type = 'application/x-blender'");
    expect(sql).toContain("mime_type = 'model/gltf-binary'");
    expect(sql).toContain("size_bytes <= 104857600");
    expect(sql).toContain("size_bytes <= 8388608");
    expect(sql).toContain("[a-f0-9]{64}\\.blend$");
    expect(sql).toContain("[0-9]+\\.[0-9]+\\.[0-9]+/[a-f0-9]{64}\\.glb$");
    expect(sql).not.toContain("grant ");
    expect(sql).not.toContain("revoke ");
    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("drop policy");
    expect(sql).not.toContain("storage.buckets");
  });

  it("accepts canonical .blend and .glb keys while rejecting malformed keys", () => {
    const incoming = `incoming/homologation/asset-v001/v001/${"a".repeat(64)}.blend`;
    const derived = `derived/homologation/asset-v001/v001/1.0.0/${"b".repeat(64)}.glb`;

    expect(incomingBlendKeyPattern.test(incoming)).toBe(true);
    expect(derivedGlbKeyPattern.test(derived)).toBe(true);
    expect(incomingBlendKeyPattern.test(`${incoming}x`)).toBe(false);
    expect(incomingBlendKeyPattern.test(incoming.replace(".blend", ".glb"))).toBe(false);
    expect(derivedGlbKeyPattern.test(derived.replace("/1.0.0/", "/1.0/"))).toBe(false);
    expect(derivedGlbKeyPattern.test(derived.replace(".glb", ".blend"))).toBe(false);
    expect(derivedGlbKeyPattern.test(derived.replace("derived/", "incoming/"))).toBe(false);
  });
});
