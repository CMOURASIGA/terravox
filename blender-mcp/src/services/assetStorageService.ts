import { randomUUID } from "node:crypto";
import {
  assetObjectIdSchema,
  buildIncomingStorageKey,
  canActorAccessAsset,
  DOWNLOAD_URL_TTL_SECONDS,
  getRetentionDeadline,
  isActorAllowedInEnvironment,
  serverActorSchema,
  uploadAuthorizationInputSchema,
  type AssetObject,
  type ServerActor,
} from "../domain/assetStorage.js";
import type { AssetStorageRepository } from "../repositories/assetStorageRepository.js";

export class AssetAuthorizationError extends Error {
  constructor(public readonly code: "ASSET_ACCESS_DENIED" | "ASSET_NOT_FOUND" | "ASSET_STATE_INVALID", message: string) {
    super(message);
  }
}

export class AssetStorageService {
  constructor(private readonly repository: AssetStorageRepository) {}

  async authorizeBlendUpload(actorInput: ServerActor, input: unknown): Promise<{
    assetObject: AssetObject;
    signedUpload: { path: string; token: string };
    uploadUrlLifetimeSeconds: number;
  }> {
    const actor = serverActorSchema.parse(actorInput);
    const request = uploadAuthorizationInputSchema.parse(input);
    if (!isActorAllowedInEnvironment(actor, request.environment)) {
      throw new AssetAuthorizationError("ASSET_ACCESS_DENIED", "Actor is not authorized for this environment");
    }

    const expectedStorageKey = buildIncomingStorageKey(
      request.environment,
      request.contract.asset,
      request.contract.source.sha256,
    );
    if (request.contract.source.storageKey !== expectedStorageKey) {
      throw new AssetAuthorizationError("ASSET_ACCESS_DENIED", "Source storage key is not the server-authorized key");
    }

    const expiresAt = getRetentionDeadline("incomplete_upload", new Date());
    if (!expiresAt) throw new Error("Source retention must have a deadline");
    const assetObject = await this.repository.createIncoming(actor, request, expectedStorageKey, expiresAt);
    const signedUpload = await this.repository.createSignedUpload(assetObject);
    return {
      assetObject,
      signedUpload,
      uploadUrlLifetimeSeconds: 2 * 60 * 60,
    };
  }

  async authorizeDerivedDownload(actorInput: ServerActor, objectIdInput: string): Promise<{
    signedDownload: { signedUrl: string; path: string };
    expiresInSeconds: number;
  }> {
    const actor = serverActorSchema.parse(actorInput);
    const objectId = assetObjectIdSchema.parse(objectIdInput);
    const assetObject = await this.repository.getById(objectId);
    if (!assetObject) throw new AssetAuthorizationError("ASSET_NOT_FOUND", "Asset object was not found");
    if (!canActorAccessAsset(actor, assetObject)) {
      throw new AssetAuthorizationError("ASSET_ACCESS_DENIED", "Actor cannot access this asset object");
    }
    if (!assetObject.bucketId.includes("derived") || !["processed", "approved"].includes(assetObject.state)) {
      throw new AssetAuthorizationError("ASSET_STATE_INVALID", "Asset object is not available for download");
    }

    return {
      signedDownload: await this.repository.createSignedDownload(assetObject, DOWNLOAD_URL_TTL_SECONDS),
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    };
  }

  async planRetentionDryRun(now = new Date(), limit = 100): Promise<{
    dryRun: true;
    runId: string;
    candidates: Array<{ id: string; bucketId: string; storageKey: string; reason: "expired" }>;
  }> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) throw new Error("limit must be an integer between 1 and 1000");
    const candidates = await this.repository.findExpired(limit, now);
    return {
      dryRun: true,
      runId: randomUUID(),
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        bucketId: candidate.bucketId,
        storageKey: candidate.storageKey,
        reason: "expired" as const,
      })),
    };
  }
}
