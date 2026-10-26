import { randomUUID } from "node:crypto";
import { createIdempotencyFingerprint } from "../domain/assetContract.js";
import {
  processingSubmissionSchema,
  type AssetArtifactRecord,
  type AssetProcessingRecord,
  type ProcessingSubmission,
} from "../domain/assetProcessing.js";
import type { ServerActor } from "../domain/assetStorage.js";
import { isActorAllowedInEnvironment, serverActorSchema } from "../domain/assetStorage.js";
import type { AssetProcessingRepository } from "../repositories/assetProcessingRepository.js";
import { JobService } from "./jobService.js";

export class ProcessingAuthorizationError extends Error {
  constructor(public readonly code: "ASSET_ACCESS_DENIED" | "PROCESSING_NOT_FOUND", message: string) {
    super(message);
  }
}

export class AssetProcessingService {
  constructor(
    private readonly processings: AssetProcessingRepository,
    private readonly jobs: JobService,
  ) {}

  async submit(actorInput: ServerActor, submissionInput: unknown): Promise<{ processing: AssetProcessingRecord; artifacts: AssetArtifactRecord[]; created: boolean }> {
    const actor = serverActorSchema.parse(actorInput);
    const submission = processingSubmissionSchema.parse(submissionInput);
    this.assertActor(actor, submission);
    const stored = await this.processings.createOrGet({
      sourceObjectId: submission.sourceObjectId,
      ownerId: actor.userId,
      environment: submission.environment,
      assetId: submission.contract.asset.assetId,
      assetVersion: submission.contract.asset.assetVersion,
      idempotencyKey: submission.contract.idempotencyKey,
      idempotencyFingerprint: createIdempotencyFingerprint(submission.contract),
      sourceSha256: submission.contract.source.sha256,
      sourceContract: submission.contract,
      correlationId: randomUUID(),
    });
    if (!stored.created) return { processing: stored.processing, artifacts: await this.processings.listArtifacts(stored.processing.id), created: false };

    try {
      const artifacts = await this.processings.createArtifacts(stored.processing.id);
      const job = await this.jobs.createAssetPipelineExport({
        assetId: stored.processing.assetId,
        processingId: stored.processing.id,
        sourceObjectId: stored.processing.sourceObjectId,
        correlationId: stored.processing.correlationId,
      });
      const queued = await this.processings.setState(stored.processing.id, "pending_verification", "queued", { jobId: job.id });
      return { processing: queued, artifacts, created: true };
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
      await this.processings.setState(stored.processing.id, "pending_verification", "failed", {
        error: { code: "PROCESSING_QUEUE_FAILED", message: "Could not queue asset processing", details: { reason: detail } },
      });
      throw error;
    }
  }

  async getForActor(actorInput: ServerActor, id: string): Promise<{ processing: AssetProcessingRecord; artifacts: AssetArtifactRecord[] }> {
    const actor = serverActorSchema.parse(actorInput);
    // Environment is intentionally discovered only through an owner-scoped query to prevent cross-environment enumeration.
    for (const environment of actor.allowedEnvironments) {
      const processing = await this.processings.getByIdForOwner(id, actor.userId, environment);
      if (processing) return { processing, artifacts: await this.processings.listArtifacts(processing.id) };
    }
    throw new ProcessingAuthorizationError("PROCESSING_NOT_FOUND", "Processing was not found for this actor");
  }

  private assertActor(actor: ServerActor, submission: ProcessingSubmission): void {
    if (!isActorAllowedInEnvironment(actor, submission.environment)) {
      throw new ProcessingAuthorizationError("ASSET_ACCESS_DENIED", "Actor is not authorized for this environment");
    }
  }
}
