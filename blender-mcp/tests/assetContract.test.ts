import { describe, expect, it } from "vitest";
import {
  ASSET_CONTRACT_VERSION,
  ASSET_MANIFEST_VERSION,
  assetManifestSchema,
  assetProcessingInputSchema,
  assetProcessingOutputSchema,
  checkIdempotentReplay,
  createIdempotencyFingerprint,
} from "../src/domain/assetContract.js";
import {
  assetProfileSchema,
  TERRAVOX_WEB_DEFAULT_PROFILE,
  validateAssetMetrics,
} from "../src/domain/assetProfile.js";

const sha = "a".repeat(64);
const outputSha = "b".repeat(64);
const idempotencyKey = "b3000000-0000-4000-8000-202610210001";

const validInput = {
  contractVersion: ASSET_CONTRACT_VERSION,
  asset: {
    assetId: "territory-br-forest-landmark-v001",
    assetType: "territory_landmark",
    assetVersion: "v001",
    displayName: "Marco da Floresta do Brasil",
    territoryId: "br-forest",
    authorship: {
      authorName: "TerraVox Art Team",
      attribution: "Created for TerraVox",
    },
    license: {
      identifier: "LicenseRef-TerraVox",
      name: "TerraVox project asset license",
    },
  },
  source: {
    storageKey: "incoming/territory-br-forest-landmark-v001.blend",
    sha256: sha,
    mediaType: "application/x-blender",
    sizeBytes: 1_024,
  },
  exportProfile: "terravox-web-default",
  idempotencyKey,
} as const;

const validMetrics = {
  triangles: 25_000,
  materials: 4,
  textures: 4,
  maxTextureWidth: 2_048,
  maxTextureHeight: 2_048,
  glbBytes: 8 * 1_024 * 1_024,
  unit: "meters",
  origin: "base_center",
  animationCount: 0,
  armatureCount: 0,
  externalReferences: [],
};

describe("B3.1 asset contract", () => {
  it("accepts the first TerraVox landmark with required authorship and license", () => {
    expect(assetProcessingInputSchema.parse(validInput)).toEqual(validInput);
  });

  it.each([
    ["absolute path", "/tmp/asset.blend"],
    ["traversal", "incoming/../secret.blend"],
    ["backslash", "incoming\\asset.blend"],
    ["URL", "https://example.com/asset.blend"],
    ["wrong prefix", "public/asset.blend"],
    ["wrong extension", "incoming/asset.py"],
  ])("rejects %s as a source storage key", (_label, storageKey) => {
    expect(
      assetProcessingInputSchema.safeParse({
        ...validInput,
        source: { ...validInput.source, storageKey },
      }).success,
    ).toBe(false);
  });

  it("rejects invalid identifiers, hashes, missing ownership metadata and extra secret fields", () => {
    expect(
      assetProcessingInputSchema.safeParse({
        ...validInput,
        asset: { ...validInput.asset, assetId: "../forest", authorship: undefined },
        source: { ...validInput.source, sha256: "ABC" },
        serviceRoleKey: "must-not-be-accepted",
      }).success,
    ).toBe(false);
  });

  it("accepts the exact configured budget boundaries", () => {
    expect(validateAssetMetrics(validMetrics)).toEqual({ valid: true, violations: [] });
  });

  it("reports stable errors for every exceeded or forbidden profile rule", () => {
    const result = validateAssetMetrics({
      ...validMetrics,
      triangles: 25_001,
      materials: 5,
      textures: 5,
      maxTextureWidth: 4_096,
      glbBytes: 8 * 1_024 * 1_024 + 1,
      unit: "centimeters",
      origin: "world",
      animationCount: 1,
      armatureCount: 1,
      externalReferences: ["//textures/external.png"],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations.map(({ code }) => code)).toEqual([
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
      ]);
    }
  });

  it("allows a separately parsed profile to configure stricter limits", () => {
    const custom = assetProfileSchema.parse({
      ...TERRAVOX_WEB_DEFAULT_PROFILE,
      name: "test-low-poly",
      limits: { ...TERRAVOX_WEB_DEFAULT_PROFILE.limits, triangles: 100 },
    });
    const result = validateAssetMetrics({ ...validMetrics, triangles: 101 }, custom);
    expect(result).toMatchObject({
      valid: false,
      violations: [{ code: "TRIANGLE_LIMIT_EXCEEDED", actual: 101, limit: 100 }],
    });
  });

  it("accepts an identical replay", () => {
    const parsed = assetProcessingInputSchema.parse(validInput);
    expect(createIdempotencyFingerprint(parsed)).toHaveLength(64);
    expect(createIdempotencyFingerprint(parsed)).toBe(createIdempotencyFingerprint(parsed));
    expect(checkIdempotentReplay(parsed, parsed)).toEqual({ replay: true });
  });

  it("accepts semantically equivalent objects with reordered properties", () => {
    const original = assetProcessingInputSchema.parse(validInput);
    const reordered = assetProcessingInputSchema.parse({
      idempotencyKey: validInput.idempotencyKey,
      exportProfile: validInput.exportProfile,
      source: {
        sizeBytes: validInput.source.sizeBytes,
        mediaType: validInput.source.mediaType,
        sha256: validInput.source.sha256,
        storageKey: validInput.source.storageKey,
      },
      asset: {
        license: {
          name: validInput.asset.license.name,
          identifier: validInput.asset.license.identifier,
        },
        authorship: {
          attribution: validInput.asset.authorship.attribution,
          authorName: validInput.asset.authorship.authorName,
        },
        territoryId: validInput.asset.territoryId,
        displayName: validInput.asset.displayName,
        assetVersion: validInput.asset.assetVersion,
        assetType: validInput.asset.assetType,
        assetId: validInput.asset.assetId,
      },
      contractVersion: validInput.contractVersion,
    });

    expect(createIdempotencyFingerprint(reordered)).toBe(createIdempotencyFingerprint(original));
    expect(checkIdempotentReplay(original, reordered)).toEqual({ replay: true });
  });

  it.each([
    [
      "license",
      { asset: { ...validInput.asset, license: { ...validInput.asset.license, identifier: "CC-BY-4.0" } } },
    ],
    [
      "authorship",
      {
        asset: {
          ...validInput.asset,
          authorship: { ...validInput.asset.authorship, authorName: "Another Artist" },
        },
      },
    ],
    ["territory", { asset: { ...validInput.asset, territoryId: "br-amazon" } }],
    ["display metadata", { asset: { ...validInput.asset, displayName: "Novo marco" } }],
    ["source size", { source: { ...validInput.source, sizeBytes: 2_048 } }],
    ["source hash", { source: { ...validInput.source, sha256: outputSha } }],
    [
      "source storage key",
      { source: { ...validInput.source, storageKey: "incoming/revision/forest-v001.blend" } },
    ],
  ])("rejects reuse of the same key after a %s change", (_label, changes) => {
    const original = assetProcessingInputSchema.parse(validInput);
    const changed = assetProcessingInputSchema.parse({ ...validInput, ...changes });

    expect(checkIdempotentReplay(original, changed)).toEqual({
      replay: false,
      code: "IDEMPOTENCY_CONFLICT",
    });
  });

  it("detects a future relevant export profile change in the canonical representation", () => {
    const original = assetProcessingInputSchema.parse(validInput);
    const changedProfile = {
      ...original,
      exportProfile: "terravox-web-default-v2",
    } as unknown as typeof original;

    expect(checkIdempotentReplay(original, changedProfile)).toEqual({
      replay: false,
      code: "IDEMPOTENCY_CONFLICT",
    });
  });

  it("does not incorporate unauthorized properties into the fingerprint", () => {
    const original = assetProcessingInputSchema.parse(validInput);
    const withCredential = {
      ...original,
      serviceRoleKey: "must-never-enter-the-fingerprint",
    } as typeof original & { serviceRoleKey: string };

    expect(createIdempotencyFingerprint(withCredential)).toBe(
      createIdempotencyFingerprint(original),
    );
  });

  it("validates accepted output and the versioned GLB manifest", () => {
    const parsed = assetProcessingInputSchema.parse(validInput);
    const fingerprint = createIdempotencyFingerprint(parsed);
    expect(
      assetProcessingOutputSchema.safeParse({
        accepted: true,
        contractVersion: ASSET_CONTRACT_VERSION,
        assetId: parsed.asset.assetId,
        assetVersion: parsed.asset.assetVersion,
        exportProfile: parsed.exportProfile,
        sourceSha256: sha,
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
      }).success,
    ).toBe(true);

    expect(
      assetManifestSchema.safeParse({
        manifestVersion: ASSET_MANIFEST_VERSION,
        contractVersion: ASSET_CONTRACT_VERSION,
        asset: parsed.asset,
        profile: { name: "terravox-web-default", version: "1.0.0" },
        source: { storageKey: parsed.source.storageKey, sha256: sha, sizeBytes: 1_024 },
        output: {
          storageKey: "derived/territory-br-forest-landmark-v001.glb",
          sha256: outputSha,
          sizeBytes: 2_048,
          mediaType: "model/gltf-binary",
        },
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        createdAt: "2026-10-21T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported manifest versions and unsafe output paths", () => {
    expect(
      assetManifestSchema.safeParse({
        manifestVersion: "2.0.0",
        contractVersion: ASSET_CONTRACT_VERSION,
        asset: validInput.asset,
        profile: { name: "terravox-web-default", version: "1.0.0" },
        source: { storageKey: validInput.source.storageKey, sha256: sha, sizeBytes: 1 },
        output: {
          storageKey: "../../asset.glb",
          sha256: outputSha,
          sizeBytes: 1,
          mediaType: "model/gltf-binary",
        },
        idempotencyKey,
        idempotencyFingerprint: sha,
        createdAt: "2026-10-21T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
