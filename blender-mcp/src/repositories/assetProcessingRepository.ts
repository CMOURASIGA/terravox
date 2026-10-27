import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  assetArtifactRecordSchema,
  assetProcessingRecordSchema,
  type AssetArtifactRecord,
  type AssetProcessingRecord,
  type ProcessingError,
  type ProcessingState,
} from "../domain/assetProcessing.js";

export interface CreateProcessingRecord {
  sourceObjectId: string;
  ownerId: string;
  environment: "homologation" | "preview" | "production";
  assetId: string;
  assetVersion: string;
  idempotencyKey: string;
  idempotencyFingerprint: string;
  sourceSha256: string;
  sourceContract: import("../domain/assetContract.js").AssetProcessingInput;
  correlationId: string;
}

export interface AssetProcessingRepository {
  createOrGet(input: CreateProcessingRecord): Promise<{ processing: AssetProcessingRecord; created: boolean }>;
  getById(id: string): Promise<AssetProcessingRecord | null>;
  getByIdForOwner(id: string, ownerId: string, environment: string): Promise<AssetProcessingRecord | null>;
  listArtifacts(processingId: string): Promise<AssetArtifactRecord[]>;
  setState(id: string, from: ProcessingState, to: ProcessingState, values?: { jobId?: string; error?: ProcessingError | null }): Promise<AssetProcessingRecord>;
  createArtifacts(processingId: string): Promise<AssetArtifactRecord[]>;
  setArtifactState(id: string, from: AssetArtifactRecord["state"], to: AssetArtifactRecord["state"], values?: {
    storageKey?: string; contentSha256?: string; sizeBytes?: number; assetObjectId?: string; error?: ProcessingError | null;
  }): Promise<AssetArtifactRecord>;
}

function databaseError(operation: string, error: { message: string; code?: string }): Error {
  return new Error(`Blender asset processing ${operation} failed (${error.code ?? "UNKNOWN"}): ${error.message}`);
}

export function parseAssetProcessingRow(row: unknown): AssetProcessingRecord {
  const r: Record<string, unknown> = row !== null && typeof row === "object" ? row as Record<string, unknown> : {};
  const candidate = {
    id: r.id, sourceObjectId: r.source_object_id, jobId: r.job_id, ownerId: r.owner_id,
    environment: r.environment, assetId: r.asset_id, assetVersion: r.asset_version,
    profileName: r.profile_name, profileVersion: r.profile_version, idempotencyKey: r.idempotency_key,
    idempotencyFingerprint: r.idempotency_fingerprint, sourceSha256: r.source_sha256, state: r.state,
    sourceContract: r.source_contract, correlationId: r.correlation_id, lastError: r.last_error, createdAt: r.created_at, updatedAt: r.updated_at,
    startedAt: r.started_at, finishedAt: r.finished_at,
  };
  const parsed = assetProcessingRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    const isUuid = (value: unknown): boolean =>
      typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const invalidFields = parsed.error.issues.map((issue) => issue.path.join(".")).join(",");
    throw new Error(
      `Blender asset processing returned malformed fields: ${invalidFields}; id_uuid=${isUuid(r.id)},correlation_id_uuid=${isUuid(r.correlation_id)}`,
    );
  }
  return parsed.data;
}

function artifact(row: unknown): AssetArtifactRecord {
  const r = row as Record<string, unknown>;
  return assetArtifactRecordSchema.parse({
    id: r.id, processingId: r.processing_id, kind: r.kind, state: r.state, storageKey: r.storage_key,
    contentSha256: r.content_sha256, sizeBytes: r.size_bytes, assetObjectId: r.asset_object_id,
    lastError: r.last_error, createdAt: r.created_at, updatedAt: r.updated_at, verifiedAt: r.verified_at,
  });
}

/** Server-only repository. Database triggers remain the final integrity authority. */
export class SupabaseAssetProcessingRepository implements AssetProcessingRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createOrGet(input: CreateProcessingRecord): Promise<{ processing: AssetProcessingRecord; created: boolean }> {
    const existing = await this.client.from("blender_asset_processings")
      .select("*").eq("owner_id", input.ownerId).eq("environment", input.environment)
      .eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (existing.error) throw databaseError("idempotency lookup", existing.error);
    if (existing.data) {
      const record = parseAssetProcessingRow(existing.data);
      if (record.idempotencyFingerprint !== input.idempotencyFingerprint) {
        const error = new Error("IDEMPOTENCY_CONFLICT"); error.name = "IdempotencyConflictError"; throw error;
      }
      return { processing: record, created: false };
    }
    const result = await this.client.from("blender_asset_processings").insert({
      source_object_id: input.sourceObjectId, owner_id: input.ownerId, environment: input.environment,
      asset_id: input.assetId, asset_version: input.assetVersion, profile_name: "terravox-web-default",
      profile_version: "1.0.0", idempotency_key: input.idempotencyKey,
      idempotency_fingerprint: input.idempotencyFingerprint, source_sha256: input.sourceSha256,
      source_contract: input.sourceContract,
      correlation_id: input.correlationId,
    }).select("*").single();
    if (result.error) {
      // A concurrent insert may have won. Re-read only the caller's idempotency identity.
      if (result.error.code === "23505") return await this.createOrGet(input);
      throw databaseError("create", result.error);
    }
    return { processing: parseAssetProcessingRow(result.data), created: true };
  }

  async getById(id: string): Promise<AssetProcessingRecord | null> {
    const result = await this.client.from("blender_asset_processings").select("*").eq("id", id).maybeSingle();
    if (result.error) throw databaseError("read", result.error);
    return result.data ? parseAssetProcessingRow(result.data) : null;
  }

  async getByIdForOwner(id: string, ownerId: string, environment: string): Promise<AssetProcessingRecord | null> {
    const result = await this.client.from("blender_asset_processings").select("*").eq("id", id)
      .eq("owner_id", ownerId).eq("environment", environment).maybeSingle();
    if (result.error) throw databaseError("authorized read", result.error);
    return result.data ? parseAssetProcessingRow(result.data) : null;
  }

  async listArtifacts(processingId: string): Promise<AssetArtifactRecord[]> {
    const result = await this.client.from("blender_asset_artifacts").select("*").eq("processing_id", processingId).order("kind");
    if (result.error) throw databaseError("artifact list", result.error);
    return result.data.map(artifact);
  }

  async setState(id: string, from: ProcessingState, to: ProcessingState, values: { jobId?: string; error?: ProcessingError | null } = {}): Promise<AssetProcessingRecord> {
    const changes: Record<string, unknown> = { state: to };
    if (values.jobId !== undefined) changes.job_id = values.jobId;
    if (values.error !== undefined) changes.last_error = values.error;
    const result = await this.client.from("blender_asset_processings").update(changes).eq("id", id).eq("state", from).select("*").maybeSingle();
    if (result.error) throw databaseError("state transition", result.error);
    if (!result.data) throw new Error(`PROCESSING_TRANSITION_CONFLICT:${from}:${to}`);
    return parseAssetProcessingRow(result.data);
  }

  async createArtifacts(processingId: string): Promise<AssetArtifactRecord[]> {
    const result = await this.client.from("blender_asset_artifacts").insert(
      (["glb", "report", "manifest"] as const).map((kind) => ({ processing_id: processingId, kind })),
    ).select("*");
    if (result.error) throw databaseError("artifact create", result.error);
    return result.data.map(artifact);
  }

  async setArtifactState(id: string, from: AssetArtifactRecord["state"], to: AssetArtifactRecord["state"], values: {
    storageKey?: string; contentSha256?: string; sizeBytes?: number; assetObjectId?: string; error?: ProcessingError | null;
  } = {}): Promise<AssetArtifactRecord> {
    const changes: Record<string, unknown> = { state: to };
    if (values.storageKey !== undefined) changes.storage_key = values.storageKey;
    if (values.contentSha256 !== undefined) changes.content_sha256 = values.contentSha256;
    if (values.sizeBytes !== undefined) changes.size_bytes = values.sizeBytes;
    if (values.assetObjectId !== undefined) changes.asset_object_id = values.assetObjectId;
    if (values.error !== undefined) changes.last_error = values.error;
    const result = await this.client.from("blender_asset_artifacts").update(changes).eq("id", id).eq("state", from).select("*").maybeSingle();
    if (result.error) throw databaseError("artifact transition", result.error);
    if (!result.data) throw new Error(`ARTIFACT_TRANSITION_CONFLICT:${from}:${to}`);
    return artifact(result.data);
  }
}

export function createSupabaseAssetProcessingRepository(url: string, serviceRoleKey: string): AssetProcessingRepository {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "terravox-blender-mcp" } },
  }) as SupabaseClient;
  return new SupabaseAssetProcessingRepository(client);
}
