import { z } from "zod";
import {
  assetMetadataSchema,
  assetProcessingInputSchema,
  assetVersionSchema,
  sha256Schema,
} from "./assetContract.js";

export const assetEnvironmentSchema = z.enum(["homologation", "preview", "production"]);
export const assetObjectKindSchema = z.enum([
  "incomplete_upload",
  "source_blend",
  "derived_glb",
  "report",
  "manifest",
  "thumbnail",
]);
export const assetObjectStateSchema = z.enum([
  "pending_upload",
  "uploaded",
  "verified",
  "processed",
  "failed",
  "approved",
  "expired",
  "deleted",
]);

export const assetObjectIdSchema = z.uuid();
export const assetBucketSchema = z.enum(["blender-assets-incoming", "blender-assets-derived"]);

export const serverActorSchema = z
  .object({
    userId: z.uuid(),
    allowedEnvironments: z.array(assetEnvironmentSchema).min(1).max(3),
  })
  .strict();

export const uploadAuthorizationInputSchema = z
  .object({
    environment: assetEnvironmentSchema,
    contract: assetProcessingInputSchema,
  })
  .strict();

export const assetObjectSchema = z
  .object({
    id: assetObjectIdSchema,
    assetId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/),
    assetVersion: assetVersionSchema,
    environment: assetEnvironmentSchema,
    ownerId: z.uuid(),
    requestedById: z.uuid(),
    bucketId: assetBucketSchema,
    storageKey: z.string().min(1).max(512),
    declaredSha256: sha256Schema,
    mimeType: z.string().min(1).max(120),
    sizeBytes: z.number().int().positive(),
    state: assetObjectStateSchema,
    referencedByGame: z.boolean(),
    correlationId: z.uuid(),
    auditMetadata: z.record(z.string(), z.unknown()),
    createdAt: z.string(),
    updatedAt: z.string(),
    uploadedAt: z.string().nullable(),
    verifiedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
    deletedAt: z.string().nullable(),
  })
  .strict();

export type AssetEnvironment = z.infer<typeof assetEnvironmentSchema>;
export type AssetObject = z.infer<typeof assetObjectSchema>;
export type AssetObjectKind = z.infer<typeof assetObjectKindSchema>;
export type ServerActor = z.infer<typeof serverActorSchema>;
export type UploadAuthorizationInput = z.infer<typeof uploadAuthorizationInputSchema>;

export const INCOMING_BUCKET = "blender-assets-incoming" as const;
export const DERIVED_BUCKET = "blender-assets-derived" as const;
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
/** Supabase signed upload URLs have a provider-controlled, fixed two-hour lifetime. */
export const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

export function buildIncomingStorageKey(
  environment: AssetEnvironment,
  asset: z.infer<typeof assetMetadataSchema>,
  sha256: string,
): string {
  const parsedHash = sha256Schema.parse(sha256);
  return `incoming/${environment}/${asset.assetId}/${asset.assetVersion}/${parsedHash}.blend`;
}

export function isActorAllowedInEnvironment(actorInput: ServerActor, environment: AssetEnvironment): boolean {
  const actor = serverActorSchema.parse(actorInput);
  return actor.allowedEnvironments.includes(environment);
}

export function canActorAccessAsset(actorInput: ServerActor, objectInput: AssetObject): boolean {
  const actor = serverActorSchema.parse(actorInput);
  const object = assetObjectSchema.parse(objectInput);
  return (
    isActorAllowedInEnvironment(actor, object.environment) &&
    (actor.userId === object.ownerId || actor.userId === object.requestedById)
  );
}

export function getRetentionDeadline(kind: AssetObjectKind, now: Date): Date | null {
  const days =
    kind === "incomplete_upload" ? 1 : kind === "source_blend" ? 7 : kind === "derived_glb" ? 30 : null;
  const milliseconds = days === null ? null : days * 24 * 60 * 60 * 1_000;
  return milliseconds === null ? null : new Date(now.getTime() + milliseconds);
}
