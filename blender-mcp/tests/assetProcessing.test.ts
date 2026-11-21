import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AssetArtifactRecord, AssetProcessingRecord, ProcessingError, ProcessingState } from "../src/domain/assetProcessing.js";
import { parseAssetArtifactRow, parseAssetProcessingRow, type AssetProcessingRepository, type CreateProcessingRecord } from "../src/repositories/assetProcessingRepository.js";
import { AssetProcessingService, ProcessingAuthorizationError } from "../src/services/assetProcessingService.js";
import { JobService } from "../src/services/jobService.js";
import { FakeJobRepository } from "./support/fakeJobRepository.js";

const owner = "11111111-1111-4111-8111-111111111111";
const otherOwner = "22222222-2222-4222-8222-222222222222";
const sourceObjectId = "33333333-3333-4333-8333-333333333333";
const key = "44444444-4444-4444-8444-444444444444";

class FakeProcessings implements AssetProcessingRepository {
  records = new Map<string, AssetProcessingRecord>();
  artifacts = new Map<string, AssetArtifactRecord[]>();
  createOrGet(input: CreateProcessingRecord) {
    const replay = [...this.records.values()].find((item) => item.ownerId === input.ownerId && item.environment === input.environment && item.idempotencyKey === input.idempotencyKey);
    if (replay) {
      if (replay.idempotencyFingerprint !== input.idempotencyFingerprint) throw new Error("IDEMPOTENCY_CONFLICT");
      return Promise.resolve({ processing: replay, created: false });
    }
    const now = new Date().toISOString();
    const processing: AssetProcessingRecord = { id: randomUUID(), sourceObjectId: input.sourceObjectId, jobId: null, ownerId: input.ownerId, environment: input.environment, assetId: input.assetId, assetVersion: input.assetVersion, profileName: "terravox-web-default", profileVersion: "1.0.0", idempotencyKey: input.idempotencyKey, idempotencyFingerprint: input.idempotencyFingerprint, sourceSha256: input.sourceSha256, sourceContract: input.sourceContract, state: "pending_verification", correlationId: input.correlationId, lastError: null, createdAt: now, updatedAt: now, startedAt: null, finishedAt: null };
    this.records.set(processing.id, processing); return Promise.resolve({ processing, created: true });
  }
  getById(id: string) { return Promise.resolve(this.records.get(id) ?? null); }
  getByIdForOwner(id: string, actor: string, environment: string) { const value = this.records.get(id); return Promise.resolve(value?.ownerId === actor && value.environment === environment ? value : null); }
  listArtifacts(id: string) { return Promise.resolve(this.artifacts.get(id) ?? []); }
  setState(id: string, from: ProcessingState, to: ProcessingState, values: { jobId?: string; error?: ProcessingError | null } = {}) {
    const value = this.records.get(id); if (!value || value.state !== from) throw new Error("PROCESSING_TRANSITION_CONFLICT");
    const updated = { ...value, state: to, jobId: values.jobId ?? value.jobId, lastError: values.error === undefined ? value.lastError : values.error, updatedAt: new Date().toISOString() } as AssetProcessingRecord;
    this.records.set(id, updated); return Promise.resolve(updated);
  }
  createArtifacts(id: string) {
    const now = new Date().toISOString(); const rows = (["glb", "report", "manifest"] as const).map((kind) => ({ id: randomUUID(), processingId: id, kind, state: "planned" as const, storageKey: null, contentSha256: null, sizeBytes: null, assetObjectId: null, lastError: null, createdAt: now, updatedAt: now, verifiedAt: null }));
    this.artifacts.set(id, rows); return Promise.resolve(rows);
  }
  setArtifactState(): Promise<AssetArtifactRecord> { return Promise.reject(new Error("not required")); }
}

function submission(idempotencyKey = key) {
  return { sourceObjectId, environment: "homologation" as const, contract: { contractVersion: "1.0.0" as const, asset: { assetId: "territory-br-forest-landmark-v001", assetType: "territory_landmark" as const, assetVersion: "v001", displayName: "Forest Landmark", territoryId: "br-forest", authorship: { authorName: "TerraVox", attribution: "TerraVox" }, license: { identifier: "LicenseRef-TerraVox", name: "TerraVox internal" } }, source: { storageKey: "incoming/homologation/territory-br-forest-landmark-v001/v001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.blend", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", mediaType: "application/x-blender" as const, sizeBytes: 128 }, exportProfile: "terravox-web-default" as const, idempotencyKey } };
}

describe("AssetProcessingService", () => {
  it("creates a single owner-scoped processing, artifacts and B2 job", async () => {
    const repository = new FakeProcessings(); const service = new AssetProcessingService(repository, new JobService(new FakeJobRepository()));
    const result = await service.submit({ userId: owner, allowedEnvironments: ["homologation"] }, submission());
    expect(result).toMatchObject({ created: true, processing: { state: "queued", ownerId: owner }, artifacts: [{ kind: "glb" }, { kind: "report" }, { kind: "manifest" }] });
    const replay = await service.submit({ userId: owner, allowedEnvironments: ["homologation"] }, submission());
    expect(replay).toMatchObject({ created: false, processing: { id: result.processing.id } });
  });

  it("rejects environment and owner enumeration", async () => {
    const repository = new FakeProcessings(); const service = new AssetProcessingService(repository, new JobService(new FakeJobRepository()));
    await expect(service.submit({ userId: owner, allowedEnvironments: ["preview"] }, submission())).rejects.toMatchObject({ code: "ASSET_ACCESS_DENIED" });
    const result = await service.submit({ userId: owner, allowedEnvironments: ["homologation"] }, submission());
    await expect(service.getForActor({ userId: otherOwner, allowedEnvironments: ["homologation"] }, result.processing.id)).rejects.toBeInstanceOf(ProcessingAuthorizationError);
  });
});

describe("asset-processing PostgREST mapping", () => {
  const processingId = "55555555-5555-4555-8555-555555555555";
  const correlationId = "66666666-6666-4666-8666-666666666666";
  const now = "2026-10-27T12:00:00.000Z";
  const validRow = () => ({
    id: processingId, source_object_id: sourceObjectId, job_id: null, owner_id: owner,
    environment: "homologation", asset_id: "territory-br-forest-landmark-v001", asset_version: "v001",
    profile_name: "terravox-web-default", profile_version: "1.0.0", idempotency_key: key,
    idempotency_fingerprint: "a".repeat(64), source_sha256: "b".repeat(64), state: "pending_verification",
    source_contract: submission().contract, correlation_id: correlationId, last_error: null,
    created_at: now, updated_at: now, started_at: null, finished_at: null,
  });

  it("maps persisted UUID identifiers without changing their values", () => {
    const mapped = parseAssetProcessingRow(validRow());
    expect(mapped.id).toBe(processingId);
    expect(mapped.correlationId).toBe(correlationId);
  });

  it("rejects malformed persisted processing identifiers", () => {
    expect(() => parseAssetProcessingRow({ ...validRow(), id: "processing-local-trace", correlation_id: "correlation-local-trace" }))
      .toThrow("Blender asset processing returned malformed fields: id,correlationId");
  });

  it("maps artifact identifiers and rejects malformed persisted artifact identifiers", () => {
    const artifactId = "77777777-7777-4777-8777-777777777777";
    const assetObjectId = "88888888-8888-4888-8888-888888888888";
    const row = {
      id: artifactId, processing_id: processingId, kind: "glb", state: "verified",
      storage_key: "derived/homologation/territory-br-forest-landmark-v001/v001/1.0.0/" + "a".repeat(64) + ".glb",
      content_sha256: "a".repeat(64), size_bytes: 42, asset_object_id: assetObjectId,
      last_error: null, created_at: now, updated_at: now, verified_at: now,
    };
    expect(parseAssetArtifactRow(row)).toMatchObject({ id: artifactId, processingId, assetObjectId });
    expect(() => parseAssetArtifactRow({ ...row, id: "artifact-local-trace", processing_id: "processing-local-trace" }))
      .toThrow("Blender asset artifact returned malformed fields: id,processingId");
  });
});
