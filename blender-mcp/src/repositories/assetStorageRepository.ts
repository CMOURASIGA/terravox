import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  assetObjectSchema,
  type AssetObject,
  type ServerActor,
  type UploadAuthorizationInput,
  DERIVED_BUCKET,
  INCOMING_BUCKET,
  UPLOAD_URL_TTL_SECONDS,
} from "../domain/assetStorage.js";

export interface AssetStorageRepository {
  createIncoming(actor: ServerActor, input: UploadAuthorizationInput, storageKey: string, expiresAt: Date): Promise<AssetObject>;
  getById(id: string): Promise<AssetObject | null>;
  findExpired(limit: number, now: Date): Promise<AssetObject[]>;
  createSignedUpload(object: AssetObject): Promise<{ path: string; token: string }>;
  createSignedDownload(object: AssetObject, expiresInSeconds: number): Promise<{ signedUrl: string; path: string }>;
}

interface AssetObjectRow {
  id: string;
  asset_id: string;
  asset_version: string;
  environment: string;
  owner_id: string;
  requested_by_id: string;
  bucket_id: string;
  storage_key: string;
  declared_sha256: string;
  mime_type: string;
  size_bytes: number;
  state: string;
  referenced_by_game: boolean;
  correlation_id: string;
  audit_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  uploaded_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  deleted_at: string | null;
}

function toAssetObject(row: AssetObjectRow): AssetObject {
  const candidate = {
    id: row.id,
    assetId: row.asset_id,
    assetVersion: row.asset_version,
    environment: row.environment,
    ownerId: row.owner_id,
    requestedById: row.requested_by_id,
    bucketId: row.bucket_id,
    storageKey: row.storage_key,
    declaredSha256: row.declared_sha256,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    state: row.state,
    referencedByGame: row.referenced_by_game,
    correlationId: row.correlation_id,
    auditMetadata: row.audit_metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    uploadedAt: row.uploaded_at,
    verifiedAt: row.verified_at,
    expiresAt: row.expires_at,
    deletedAt: row.deleted_at,
  };
  const parsed = assetObjectSchema.safeParse(candidate);
  if (!parsed.success) {
    const invalidFields = parsed.error.issues.map((issue) => issue.path.join(".")).join(",");
    const isUuid = (value: unknown): boolean => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const identifierShape = [
      `id_present=${typeof row.id === "string" && row.id.length > 0}`,
      `id_uuid=${isUuid(row.id)}`,
      `correlation_id_present=${typeof row.correlation_id === "string" && row.correlation_id.length > 0}`,
      `correlation_id_uuid=${isUuid(row.correlation_id)}`,
    ].join(",");
    throw new Error(`Blender asset storage returned malformed metadata fields: ${invalidFields}; ${identifierShape}`);
  }
  return parsed.data;
}

function storageError(operation: string, error: { message: string; statusCode?: string }): Error {
  return new Error(`Blender asset storage ${operation} failed (${error.statusCode ?? "UNKNOWN"}): ${error.message}`);
}

export class SupabaseAssetStorageRepository implements AssetStorageRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createIncoming(actor: ServerActor, input: UploadAuthorizationInput, storageKey: string, expiresAt: Date): Promise<AssetObject> {
    const { contract, environment } = input;
    const { data, error } = await this.client
      .from("blender_asset_objects")
      .insert({
        asset_id: contract.asset.assetId,
        asset_version: contract.asset.assetVersion,
        environment,
        owner_id: actor.userId,
        requested_by_id: actor.userId,
        bucket_id: INCOMING_BUCKET,
        storage_key: storageKey,
        declared_sha256: contract.source.sha256,
        mime_type: contract.source.mediaType,
        size_bytes: contract.source.sizeBytes,
        state: "pending_upload",
        correlation_id: randomUUID(),
        expires_at: expiresAt.toISOString(),
        audit_metadata: {
          contractVersion: contract.contractVersion,
          assetType: contract.asset.assetType,
          territoryId: contract.asset.territoryId,
          exportProfile: contract.exportProfile,
          idempotencyKey: contract.idempotencyKey,
        },
      })
      .select("*")
      .single<AssetObjectRow>();
    if (error) throw storageError("create metadata", error);
    return toAssetObject(data);
  }

  async getById(id: string): Promise<AssetObject | null> {
    const { data, error } = await this.client.from("blender_asset_objects").select("*").eq("id", id).maybeSingle<AssetObjectRow>();
    if (error) throw storageError("read metadata", error);
    return data ? toAssetObject(data) : null;
  }

  async findExpired(limit: number, now: Date): Promise<AssetObject[]> {
    const { data, error } = await this.client
      .from("blender_asset_objects")
      .select("*")
      .lte("expires_at", now.toISOString())
      .eq("referenced_by_game", false)
      .neq("state", "deleted")
      .is("deleted_at", null)
      .order("expires_at", { ascending: true })
      .limit(limit);
    if (error) throw storageError("find expired metadata", error);
    return (data as AssetObjectRow[]).map(toAssetObject);
  }

  async createSignedUpload(object: AssetObject): Promise<{ path: string; token: string }> {
    const { data, error } = await this.client.storage.from(object.bucketId).createSignedUploadUrl(object.storageKey);
    if (error) throw storageError("create signed upload URL", error);
    return { path: data.path, token: data.token };
  }

  async createSignedDownload(object: AssetObject, expiresInSeconds: number): Promise<{ signedUrl: string; path: string }> {
    if (object.bucketId !== DERIVED_BUCKET) throw new Error("Only derived artifacts can be downloaded");
    const { data, error } = await this.client.storage.from(object.bucketId).createSignedUrl(object.storageKey, expiresInSeconds, { download: true });
    if (error) throw storageError("create signed download URL", error);
    return { signedUrl: data.signedUrl, path: object.storageKey };
  }
}

export function createSupabaseAssetStorageRepository(url: string, serviceRoleKey: string): AssetStorageRepository {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "terravox-blender-mcp" } },
  });
  return new SupabaseAssetStorageRepository(client);
}

export const storageProviderUploadLifetimeSeconds = UPLOAD_URL_TTL_SECONDS;
