import { z } from "zod";
import {
  assetContractErrorCodeSchema,
  TERRAVOX_WEB_PROFILE_NAME,
  TERRAVOX_WEB_PROFILE_VERSION,
  type AssetContractErrorCode,
} from "./assetContract.js";

export const assetProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    limits: z
      .object({
        triangles: z.number().int().positive(),
        materials: z.number().int().positive(),
        textures: z.number().int().nonnegative(),
        textureWidth: z.number().int().positive(),
        textureHeight: z.number().int().positive(),
        glbBytes: z.number().int().positive(),
      })
      .strict(),
    unit: z.literal("meters"),
    origin: z.literal("base_center"),
    allowAnimations: z.boolean(),
    allowArmatures: z.boolean(),
    allowExternalReferences: z.boolean(),
  })
  .strict();

export const TERRAVOX_WEB_DEFAULT_PROFILE = assetProfileSchema.parse({
  name: TERRAVOX_WEB_PROFILE_NAME,
  version: TERRAVOX_WEB_PROFILE_VERSION,
  limits: {
    triangles: 25_000,
    materials: 4,
    textures: 4,
    textureWidth: 2_048,
    textureHeight: 2_048,
    glbBytes: 8 * 1_024 * 1_024,
  },
  unit: "meters",
  origin: "base_center",
  allowAnimations: false,
  allowArmatures: false,
  allowExternalReferences: false,
});

export const assetMetricsSchema = z
  .object({
    triangles: z.number().int().nonnegative(),
    materials: z.number().int().nonnegative(),
    textures: z.number().int().nonnegative(),
    maxTextureWidth: z.number().int().nonnegative(),
    maxTextureHeight: z.number().int().nonnegative(),
    glbBytes: z.number().int().nonnegative(),
    unit: z.string().trim().min(1).max(32),
    origin: z.string().trim().min(1).max(32),
    animationCount: z.number().int().nonnegative(),
    armatureCount: z.number().int().nonnegative(),
    externalReferences: z.array(z.string().trim().min(1).max(256)).max(100),
  })
  .strict();

export type AssetProfile = z.infer<typeof assetProfileSchema>;
export type AssetMetrics = z.infer<typeof assetMetricsSchema>;

export interface AssetProfileViolation {
  code: AssetContractErrorCode;
  actual: number | string;
  limit: number | string;
}

export function validateAssetMetrics(
  metricsInput: unknown,
  profileInput: AssetProfile = TERRAVOX_WEB_DEFAULT_PROFILE,
): { valid: true; violations: [] } | { valid: false; violations: AssetProfileViolation[] } {
  const metricsResult = assetMetricsSchema.safeParse(metricsInput);
  const profileResult = assetProfileSchema.safeParse(profileInput);
  if (!metricsResult.success || !profileResult.success) {
    return {
      valid: false,
      violations: [{ code: "CONTRACT_INVALID", actual: "invalid", limit: "valid schema" }],
    };
  }

  const metrics = metricsResult.data;
  const profile = profileResult.data;
  const violations: AssetProfileViolation[] = [];
  const add = (code: AssetContractErrorCode, actual: number | string, limit: number | string) => {
    assetContractErrorCodeSchema.parse(code);
    violations.push({ code, actual, limit });
  };

  if (metrics.triangles > profile.limits.triangles)
    add("TRIANGLE_LIMIT_EXCEEDED", metrics.triangles, profile.limits.triangles);
  if (metrics.materials > profile.limits.materials)
    add("MATERIAL_LIMIT_EXCEEDED", metrics.materials, profile.limits.materials);
  if (metrics.textures > profile.limits.textures)
    add("TEXTURE_LIMIT_EXCEEDED", metrics.textures, profile.limits.textures);
  if (
    metrics.maxTextureWidth > profile.limits.textureWidth ||
    metrics.maxTextureHeight > profile.limits.textureHeight
  )
    add(
      "TEXTURE_RESOLUTION_EXCEEDED",
      `${metrics.maxTextureWidth}x${metrics.maxTextureHeight}`,
      `${profile.limits.textureWidth}x${profile.limits.textureHeight}`,
    );
  if (metrics.glbBytes > profile.limits.glbBytes)
    add("GLB_SIZE_LIMIT_EXCEEDED", metrics.glbBytes, profile.limits.glbBytes);
  if (metrics.unit !== profile.unit) add("UNIT_NOT_ALLOWED", metrics.unit, profile.unit);
  if (metrics.origin !== profile.origin) add("ORIGIN_NOT_ALLOWED", metrics.origin, profile.origin);
  if (!profile.allowAnimations && metrics.animationCount > 0)
    add("ANIMATION_NOT_ALLOWED", metrics.animationCount, 0);
  if (!profile.allowArmatures && metrics.armatureCount > 0)
    add("ARMATURE_NOT_ALLOWED", metrics.armatureCount, 0);
  if (!profile.allowExternalReferences && metrics.externalReferences.length > 0)
    add("EXTERNAL_REFERENCE_BLOCKED", metrics.externalReferences.length, 0);

  return violations.length === 0 ? { valid: true, violations: [] } : { valid: false, violations };
}
