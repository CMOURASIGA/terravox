import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DERIVED_BUCKET, assetObjectSchema, type AssetObject } from "../domain/assetStorage.js";
import type { AssetProcessingRecord, ArtifactKind } from "../domain/assetProcessing.js";
import { derivedStorageKey } from "../domain/assetProcessing.js";

export interface StoredObject {
  object: AssetObject;
  bytes: Uint8Array;
}

export interface ProcessingObjectStore {
  downloadSource(sourceObjectId: string): Promise<StoredObject>;
  uploadDerived(input: { processing: AssetProcessingRecord; kind: ArtifactKind; bytes: Uint8Array; mediaType: "model/gltf-binary" | "application/json" }): Promise<AssetObject>;
}

function dbError(action: string, error: { message: string; code?: string }): Error {
  return new Error(`Processing object store ${action} failed (${error.code ?? "UNKNOWN"}): ${error.message}`);
}

export function parseProcessingObjectRow(row: unknown): AssetObject {
  const r: Record<string, unknown> = row !== null && typeof row === "object" ? row as Record<string, unknown> : {};
  const candidate = {
    id: r.id, assetId: r.asset_id, assetVersion: r.asset_version, environment: r.environment,
    ownerId: r.owner_id, requestedById: r.requested_by_id, bucketId: r.bucket_id, storageKey: r.storage_key,
    declaredSha256: r.declared_sha256, mimeType: r.mime_type, sizeBytes: r.size_bytes, state: r.state,
    referencedByGame: r.referenced_by_game, correlationId: r.correlation_id, auditMetadata: r.audit_metadata,
    createdAt: r.created_at, updatedAt: r.updated_at, uploadedAt: r.uploaded_at, verifiedAt: r.verified_at,
    expiresAt: r.expires_at, deletedAt: r.deleted_at,
  };
  const parsed = assetObjectSchema.safeParse(candidate);
  if (!parsed.success) {
    const isUuid = (value: unknown): boolean =>
      typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const invalidFields = parsed.error.issues.map((issue) => issue.path.join(".")).join(",");
    throw new Error(
      `Processing object store returned malformed metadata fields: ${invalidFields}; id_uuid=${isUuid(r.id)},correlation_id_uuid=${isUuid(r.correlation_id)}`,
    );
  }
  return parsed.data;
}

export class SupabaseProcessingObjectStore implements ProcessingObjectStore {
  constructor(private readonly client: SupabaseClient) {}

  async downloadSource(sourceObjectId: string): Promise<StoredObject> {
    const row = await this.client.from("blender_asset_objects").select("*").eq("id", sourceObjectId).maybeSingle();
    if (row.error) throw dbError("source metadata read", row.error);
    if (!row.data) throw new Error("SOURCE_NOT_FOUND");
    const object = parseProcessingObjectRow(row.data);
    if (object.bucketId !== "blender-assets-incoming" || object.mimeType !== "application/x-blender" || !["uploaded", "verified"].includes(object.state)) {
      throw new Error("SOURCE_NOT_AVAILABLE");
    }
    const downloaded = await this.client.storage.from(object.bucketId).download(object.storageKey);
    if (downloaded.error) throw dbError("source download", downloaded.error);
    return { object, bytes: new Uint8Array(await downloaded.data.arrayBuffer()) };
  }

  async uploadDerived(input: { processing: AssetProcessingRecord; kind: ArtifactKind; bytes: Uint8Array; mediaType: "model/gltf-binary" | "application/json" }): Promise<AssetObject> {
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const storageKey = derivedStorageKey(input.processing, input.kind, sha256);
    const upload = await this.client.storage.from(DERIVED_BUCKET).upload(storageKey, input.bytes, {
      contentType: input.mediaType, upsert: false,
    });
    if (upload.error && !/already exists/i.test(upload.error.message)) throw dbError("derived upload", upload.error);
    const row = await this.client.from("blender_asset_objects").insert({
      asset_id: input.processing.assetId, asset_version: input.processing.assetVersion,
      environment: input.processing.environment, owner_id: input.processing.ownerId, requested_by_id: input.processing.ownerId,
      bucket_id: DERIVED_BUCKET, storage_key: storageKey, declared_sha256: sha256, mime_type: input.mediaType,
      size_bytes: input.bytes.byteLength, state: "processed", correlation_id: input.processing.correlationId,
      audit_metadata: { processingId: input.processing.id, kind: input.kind },
    }).select("*").single();
    if (row.error) throw dbError("derived metadata", row.error);
    return parseProcessingObjectRow(row.data);
  }
}

export function createSupabaseProcessingObjectStore(url: string, serviceRoleKey: string): ProcessingObjectStore {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "terravox-blender-worker" } },
  }) as SupabaseClient;
  return new SupabaseProcessingObjectStore(client);
}
