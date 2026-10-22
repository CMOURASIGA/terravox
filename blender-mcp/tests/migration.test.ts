import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../supabase/migrations/20260922151056_create_blender_jobs.sql",
  import.meta.url,
);
const assetStorageMigrationUrl = new URL(
  "../supabase/migrations/20261021192826_create_blender_asset_storage.sql",
  import.meta.url,
);
const derivedArtifactsMigrationUrl = new URL(
  "../supabase/migrations/20261022170000_allow_blender_derived_artifacts.sql",
  import.meta.url,
);
const rlsLockdownMigrationUrl = new URL(
  "../supabase/migrations/20261022181500_lock_down_blender_asset_object_client_writes.sql",
  import.meta.url,
);
const reconciledClientPoliciesMigrationUrl = new URL(
  "../supabase/migrations/20261022190000_remove_recreated_blender_asset_client_policies.sql",
  import.meta.url,
);

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

  it("removes only the client policies recreated outside the repository", async () => {
    const sql = (await readFile(reconciledClientPoliciesMigrationUrl, "utf8")).toLowerCase();
    expect(sql).toContain("drop policy if exists blender_asset_objects_select_own_environment");
    expect(sql).toContain("drop policy if exists blender_asset_objects_insert_own_environment");
    expect(sql).toContain("drop policy if exists blender_asset_objects_update_own_environment");
    expect(sql).not.toContain("grant ");
    expect(sql).not.toContain("revoke ");
    expect(sql).not.toContain("storage.buckets");
  });
});
