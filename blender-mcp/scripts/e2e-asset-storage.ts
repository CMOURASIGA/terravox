import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { buildIncomingStorageKey } from "../src/domain/assetStorage.js";
import { createSupabaseAssetStorageRepository } from "../src/repositories/assetStorageRepository.js";
import { AssetAuthorizationError, AssetStorageService } from "../src/services/assetStorageService.js";

const ref = "xrlfacfivlaeatzffcde";
const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (new URL(url).hostname !== `${ref}.supabase.co` || !key) throw new Error("authorized Supabase credentials are required");

const runId = randomUUID();
const ownerId = randomUUID();
const outsiderId = randomUUID();
const assetId = `qa-b32-${runId.slice(0, 12)}`;
const source = Buffer.concat([Buffer.from("BLENDER-v280"), Buffer.alloc(1012)]);
const derived = Buffer.from(JSON.stringify({ fixture: "b3.2", runId }), "utf8");
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const sourceSha = sha(source);
const derivedSha = sha(derived);
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const service = new AssetStorageService(createSupabaseAssetStorageRepository(url, key));
const objectIds: string[] = [];
const objectRefs: Array<{ bucket: string; path: string }> = [];

async function denied(work: () => Promise<unknown>) {
  try { await work(); return false; } catch (error) { return error instanceof AssetAuthorizationError && error.code === "ASSET_ACCESS_DENIED"; }
}

async function cleanup() {
  for (const object of objectRefs) {
    const { error } = await client.storage.from(object.bucket).remove([object.path]);
    if (error) throw new Error("synthetic object cleanup failed");
  }
  if (objectIds.length) {
    const { error } = await client.from("blender_asset_objects").delete().in("id", objectIds).eq("owner_id", ownerId);
    if (error) throw new Error("synthetic metadata cleanup failed");
    const { count, error: verifyError } = await client.from("blender_asset_objects").select("id", { count: "exact", head: true }).in("id", objectIds);
    if (verifyError || count !== 0) throw new Error("synthetic metadata residue detected");
  }
}

try {
  const asset = { assetId, assetType: "territory_landmark" as const, assetVersion: "v001", displayName: "QA B3.2 Storage Fixture", territoryId: "qa-storage", authorship: { authorName: "TerraVox QA", attribution: "Synthetic only" }, license: { identifier: "LicenseRef-QA", name: "QA only" } };
  const sourceKey = buildIncomingStorageKey("homologation", asset, sourceSha);
  const request = { environment: "homologation" as const, contract: { contractVersion: "1.0.0" as const, asset, source: { storageKey: sourceKey, sha256: sourceSha, mediaType: "application/x-blender" as const, sizeBytes: source.length }, exportProfile: "terravox-web-default" as const, idempotencyKey: randomUUID() } };
  const environmentDenied = await denied(() => service.authorizeBlendUpload({ userId: ownerId, allowedEnvironments: ["preview"] }, request));
  if (!environmentDenied) throw new Error("environment isolation failed");
  const upload = await service.authorizeBlendUpload({ userId: ownerId, allowedEnvironments: ["homologation"] }, request);
  objectIds.push(upload.assetObject.id); objectRefs.push({ bucket: upload.assetObject.bucketId, path: upload.assetObject.storageKey });
  const uploadResult = await client.storage.from(upload.assetObject.bucketId).uploadToSignedUrl(upload.signedUpload.path, upload.signedUpload.token, source, { contentType: "application/x-blender" });
  if (uploadResult.error) throw new Error("signed upload failed");
  const listed = await client.storage.from(upload.assetObject.bucketId).list(`incoming/homologation/${assetId}/v001`);
  if (listed.error || !listed.data.some((item) => item.name === `${sourceSha}.blend`)) throw new Error("uploaded object not found");
  const derivedPath = `derived/homologation/${assetId}/v001/1.0.0/${derivedSha}.report.json`;
  objectRefs.push({ bucket: "blender-assets-derived", path: derivedPath });
  const derivedUpload = await client.storage.from("blender-assets-derived").upload(derivedPath, derived, { contentType: "application/json", upsert: false });
  if (derivedUpload.error) throw new Error("derived fixture upload failed");
  const inserted = await client.from("blender_asset_objects").insert({ asset_id: assetId, asset_version: "v001", environment: "homologation", owner_id: ownerId, requested_by_id: ownerId, bucket_id: "blender-assets-derived", storage_key: derivedPath, declared_sha256: derivedSha, mime_type: "application/json", size_bytes: derived.length, state: "processed", correlation_id: runId, audit_metadata: { testRun: runId } }).select("id").single();
  if (inserted.error || !inserted.data) throw new Error("derived metadata creation failed");
  const derivedId = String(inserted.data.id);
  objectIds.push(derivedId);
  const outsiderDenied = await denied(() => service.authorizeDerivedDownload({ userId: outsiderId, allowedEnvironments: ["homologation"] }, derivedId));
  if (!outsiderDenied) throw new Error("owner isolation failed");
  const download = await service.authorizeDerivedDownload({ userId: ownerId, allowedEnvironments: ["homologation"] }, derivedId);
  const response = await fetch(download.signedDownload.signedUrl);
  const received = Buffer.from(await response.arrayBuffer());
  if (!response.ok || sha(received) !== derivedSha) throw new Error("signed download integrity failed");
  const direct = await fetch(`${url}/storage/v1/object/public/blender-assets-derived/${derivedPath}`);
  if (direct.ok) throw new Error("public direct access was accepted");
  const retention = await service.planRetentionDryRun(new Date(), 10);
  if (!retention.dryRun) throw new Error("retention dry-run failed");
  console.log(JSON.stringify({ ok: true, runId, uploadTtlSeconds: upload.uploadUrlLifetimeSeconds, downloadTtlSeconds: download.expiresInSeconds, expirationRuntime: "NOT_TESTED", directPublicAccess: "DENIED", outsider: "DENIED", environment: "DENIED", retentionDryRun: true }));
} finally { await cleanup(); console.log(JSON.stringify({ cleanup: "PASS", runId })); }
