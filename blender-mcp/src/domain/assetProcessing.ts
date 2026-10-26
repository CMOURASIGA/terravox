import { z } from "zod";
import {
  assetManifestSchema,
  assetProcessingInputSchema,
  assetVersionSchema,
  sha256Schema,
  type AssetProcessingInput,
} from "./assetContract.js";
import { assetEnvironmentSchema } from "./assetStorage.js";
import { assetMetricsSchema } from "./assetProfile.js";

export const processingStateSchema = z.enum([
  "pending_verification",
  "queued",
  "processing",
  "verifying_output",
  "completed",
  "failed",
  "cancelled",
]);
export const artifactKindSchema = z.enum(["glb", "report", "manifest"]);
export const artifactStateSchema = z.enum(["planned", "uploading", "stored", "verified", "failed"]);

export const processingErrorSchema = z.object({
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
  details: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const assetProcessingRecordSchema = z.object({
  id: z.uuid(),
  sourceObjectId: z.uuid(),
  jobId: z.uuid().nullable(),
  ownerId: z.uuid(),
  environment: assetEnvironmentSchema,
  assetId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/),
  assetVersion: assetVersionSchema,
  profileName: z.literal("terravox-web-default"),
  profileVersion: z.literal("1.0.0"),
  idempotencyKey: z.uuid(),
  idempotencyFingerprint: sha256Schema,
  sourceSha256: sha256Schema,
  state: processingStateSchema,
  correlationId: z.uuid(),
  lastError: processingErrorSchema.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  startedAt: z.iso.datetime({ offset: true }).nullable(),
  finishedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict();

export const assetArtifactRecordSchema = z.object({
  id: z.uuid(),
  processingId: z.uuid(),
  kind: artifactKindSchema,
  state: artifactStateSchema,
  storageKey: z.string().min(1).max(512).nullable(),
  contentSha256: sha256Schema.nullable(),
  sizeBytes: z.number().int().positive().nullable(),
  assetObjectId: z.uuid().nullable(),
  lastError: processingErrorSchema.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  verifiedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict();

export const processingSubmissionSchema = z.object({
  sourceObjectId: z.uuid(),
  environment: assetEnvironmentSchema,
  contract: assetProcessingInputSchema,
}).strict();

export const validationReportSchema = z.object({
  schemaVersion: z.literal(1),
  correlationId: z.uuid(),
  valid: z.boolean(),
  metrics: assetMetricsSchema,
  errors: z.array(processingErrorSchema).max(50),
  warnings: z.array(z.string().trim().min(1).max(500)).max(100),
}).strict();

export const processingResultSchema = z.object({
  processing: assetProcessingRecordSchema,
  artifacts: z.array(assetArtifactRecordSchema).length(3),
  report: validationReportSchema.nullable(),
  manifest: assetManifestSchema.nullable(),
}).strict();

export type AssetProcessingRecord = z.infer<typeof assetProcessingRecordSchema>;
export type AssetArtifactRecord = z.infer<typeof assetArtifactRecordSchema>;
export type ArtifactKind = z.infer<typeof artifactKindSchema>;
export type ProcessingState = z.infer<typeof processingStateSchema>;
export type ProcessingError = z.infer<typeof processingErrorSchema>;
export type ProcessingSubmission = z.infer<typeof processingSubmissionSchema>;
export type ValidationReport = z.infer<typeof validationReportSchema>;

export function sourceContractFromSubmission(input: ProcessingSubmission): AssetProcessingInput {
  return input.contract;
}

export function derivedStorageKey(
  processing: Pick<AssetProcessingRecord, "environment" | "assetId" | "assetVersion" | "profileVersion">,
  kind: ArtifactKind,
  sha256: string,
): string {
  const suffix = kind === "glb" ? ".glb" : kind === "report" ? ".report.json" : ".manifest.json";
  return `derived/${processing.environment}/${processing.assetId}/${processing.assetVersion}/${processing.profileVersion}/${sha256}${suffix}`;
}
