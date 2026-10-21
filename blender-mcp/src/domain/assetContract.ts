import { createHash } from "node:crypto";
import { z } from "zod";
import { assetIdSchema } from "./job.js";

export const ASSET_CONTRACT_VERSION = "1.0.0" as const;
export const ASSET_MANIFEST_VERSION = "1.0.0" as const;
export const TERRAVOX_WEB_PROFILE_NAME = "terravox-web-default" as const;
export const TERRAVOX_WEB_PROFILE_VERSION = "1.0.0" as const;

export const assetTypeSchema = z.enum(["territory_landmark"]);
export const assetVersionSchema = z
  .string()
  .regex(/^v[0-9]{3}$/, "assetVersion must use the vNNN format");
export const sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "sha256 must contain 64 lowercase hexadecimal characters");
export const idempotencyKeySchema = z.uuid();
export const assetExportProfileNameSchema = z.literal(TERRAVOX_WEB_PROFILE_NAME);

const safeStorageKey = (prefix: "incoming" | "derived", extension: "blend" | "glb") =>
  z
    .string()
    .trim()
    .min(1)
    .max(256)
    .refine((value) => !value.includes("\\") && !value.includes(".."), {
      message: "storageKey cannot contain traversal or backslash segments",
    })
    .refine((value) => !value.startsWith("/") && !value.includes("://"), {
      message: "storageKey must be a relative storage key, not a path or URL",
    })
    .refine(
      (value) => {
        const segments = value.split("/");
        return (
          segments.length >= 2 &&
          segments[0] === prefix &&
          segments.every((segment) => /^[a-z0-9][a-z0-9._-]*$/.test(segment)) &&
          value.endsWith(`.${extension}`)
        );
      },
      { message: `storageKey must match ${prefix}/.../*.${extension}` },
    );

export const sourceStorageKeySchema = safeStorageKey("incoming", "blend");
export const outputStorageKeySchema = safeStorageKey("derived", "glb");

export const authorshipSchema = z
  .object({
    authorName: z.string().trim().min(2).max(120),
    attribution: z.string().trim().min(2).max(500),
    sourceUrl: z.url().max(2_000).optional(),
  })
  .strict();

export const assetLicenseSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[A-Za-z0-9][A-Za-z0-9.+-]*$/, "license identifier must be SPDX-compatible"),
    name: z.string().trim().min(2).max(160),
    referenceUrl: z.url().max(2_000).optional(),
  })
  .strict();

export const assetMetadataSchema = z
  .object({
    assetId: assetIdSchema,
    assetType: assetTypeSchema,
    assetVersion: assetVersionSchema,
    displayName: z.string().trim().min(3).max(120),
    territoryId: z.string().regex(/^[a-z]{2}-[a-z0-9-]{2,32}$/),
    authorship: authorshipSchema,
    license: assetLicenseSchema,
  })
  .strict();

export const assetProcessingInputSchema = z
  .object({
    contractVersion: z.literal(ASSET_CONTRACT_VERSION),
    asset: assetMetadataSchema,
    source: z
      .object({
        storageKey: sourceStorageKeySchema,
        sha256: sha256Schema,
        mediaType: z.literal("application/x-blender"),
        sizeBytes: z.number().int().positive(),
      })
      .strict(),
    exportProfile: assetExportProfileNameSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const assetContractErrorCodeSchema = z.enum([
  "CONTRACT_INVALID",
  "SOURCE_NOT_FOUND",
  "SOURCE_HASH_MISMATCH",
  "SOURCE_TOO_LARGE",
  "INVALID_SOURCE_PATH",
  "IDEMPOTENCY_CONFLICT",
  "PROFILE_NOT_FOUND",
  "TRIANGLE_LIMIT_EXCEEDED",
  "MATERIAL_LIMIT_EXCEEDED",
  "TEXTURE_LIMIT_EXCEEDED",
  "TEXTURE_RESOLUTION_EXCEEDED",
  "GLB_SIZE_LIMIT_EXCEEDED",
  "UNIT_NOT_ALLOWED",
  "ORIGIN_NOT_ALLOWED",
  "ANIMATION_NOT_ALLOWED",
  "ARMATURE_NOT_ALLOWED",
  "EXTERNAL_REFERENCE_BLOCKED",
  "BLEND_OPEN_FAILED",
  "ASSET_VALIDATION_FAILED",
  "EXPORT_FAILED",
  "OUTPUT_VALIDATION_FAILED",
  "STORAGE_WRITE_FAILED",
  "LEASE_LOST",
  "TIMEOUT",
]);

export const assetContractErrorSchema = z
  .object({
    code: assetContractErrorCodeSchema,
    message: z.string().trim().min(1).max(500),
    field: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const assetProcessingOutputSchema = z.discriminatedUnion("accepted", [
  z
    .object({
      accepted: z.literal(true),
      contractVersion: z.literal(ASSET_CONTRACT_VERSION),
      assetId: assetIdSchema,
      assetVersion: assetVersionSchema,
      exportProfile: assetExportProfileNameSchema,
      sourceSha256: sha256Schema,
      idempotencyKey: idempotencyKeySchema,
      idempotencyFingerprint: sha256Schema,
    })
    .strict(),
  z
    .object({
      accepted: z.literal(false),
      contractVersion: z.literal(ASSET_CONTRACT_VERSION),
      errors: z.array(assetContractErrorSchema).min(1).max(50),
    })
    .strict(),
]);

export const assetManifestSchema = z
  .object({
    manifestVersion: z.literal(ASSET_MANIFEST_VERSION),
    contractVersion: z.literal(ASSET_CONTRACT_VERSION),
    asset: assetMetadataSchema,
    profile: z
      .object({
        name: assetExportProfileNameSchema,
        version: z.literal(TERRAVOX_WEB_PROFILE_VERSION),
      })
      .strict(),
    source: z
      .object({
        storageKey: sourceStorageKeySchema,
        sha256: sha256Schema,
        sizeBytes: z.number().int().positive(),
      })
      .strict(),
    output: z
      .object({
        storageKey: outputStorageKeySchema,
        sha256: sha256Schema,
        sizeBytes: z.number().int().positive(),
        mediaType: z.literal("model/gltf-binary"),
      })
      .strict(),
    idempotencyKey: idempotencyKeySchema,
    idempotencyFingerprint: sha256Schema,
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type AssetProcessingInput = z.infer<typeof assetProcessingInputSchema>;
export type AssetContractErrorCode = z.infer<typeof assetContractErrorCodeSchema>;

type CanonicalJson = null | boolean | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };

function stableJson(value: CanonicalJson): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key]!)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalIdempotencyPayload(input: AssetProcessingInput): string {
  const payload: CanonicalJson = {
    asset: {
      assetId: input.asset.assetId,
      assetType: input.asset.assetType,
      assetVersion: input.asset.assetVersion,
      authorship: {
        attribution: input.asset.authorship.attribution,
        authorName: input.asset.authorship.authorName,
        ...(input.asset.authorship.sourceUrl === undefined
          ? {}
          : { sourceUrl: input.asset.authorship.sourceUrl }),
      },
      displayName: input.asset.displayName,
      license: {
        identifier: input.asset.license.identifier,
        name: input.asset.license.name,
        ...(input.asset.license.referenceUrl === undefined
          ? {}
          : { referenceUrl: input.asset.license.referenceUrl }),
      },
      territoryId: input.asset.territoryId,
    },
    contractVersion: input.contractVersion,
    exportProfile: input.exportProfile,
    idempotencyKey: input.idempotencyKey,
    source: {
      mediaType: input.source.mediaType,
      sha256: input.source.sha256,
      sizeBytes: input.source.sizeBytes,
      storageKey: input.source.storageKey,
    },
  };

  return stableJson(payload);
}

export function createIdempotencyFingerprint(input: AssetProcessingInput): string {
  return createHash("sha256").update(canonicalIdempotencyPayload(input), "utf8").digest("hex");
}

export function checkIdempotentReplay(
  original: AssetProcessingInput,
  replay: AssetProcessingInput,
): { replay: true } | { replay: false; code: "IDEMPOTENCY_CONFLICT" } {
  return createIdempotencyFingerprint(original) === createIdempotencyFingerprint(replay)
    ? { replay: true }
    : { replay: false, code: "IDEMPOTENCY_CONFLICT" };
}
