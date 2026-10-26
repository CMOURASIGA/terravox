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

function asAsset(row: Record<string, unknown>): AssetObject {
  return assetObjectSchema.parse({
    id: row.id, assetId: row.asset_id, assetVersion: row.asset_version, environment: row.environment,
    ownerId: row.owner_id, requestedById: row.requested_by_id, bucketId: row.bucket_id, storageKey: row.storage_key,
    declaredSha256: row.declared_sha256, mimeType: row.mime_type, sizeBytes: row.size_bytes, state: row.state,
    referencedByGame: row.referenced_by_game, correlationId: row.correlation_id, auditMetadata: row.audit_metadata,
    createdAt: row.created_at, updatedAt: row.updated_at, uploadedAt: row.uploaded_at, verifiedAt: row.verified_at,
    expiresAt: row.expires_at, deletedAt: row.deleted_at,
  });
}

export class SupabaseProcessingObjectStore implements ProcessingObjectStore {
  constructor(private readonly client: SupabaseClient) {}

  async downloadSource(sourceObjectId: string): Promise<StoredObject> {
    const row = await this.client.from("blender_asset_objects").select("*").eq("id", sourceObjectId).maybeSingle();
    if (row.error) throw dbError("source metadata read", row.error);
    if (!row.data) throw new Error("SOURCE_NOT_FOUND");
    const object = asAsset(row.data as Record<string, unknown>);
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
    return asAsset(row.data as Record<string, unknown>);
  }
}

export function createSupabaseProcessingObjectStore(url: string, serviceRoleKey: string): ProcessingObjectStore {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "terravox-blender-worker" } },
  }) as SupabaseClient;
  return new SupabaseProcessingObjectStore(client);
}
