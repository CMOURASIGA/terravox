import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assetObjectSchema,
  buildIncomingStorageKey,
  type AssetObject,
  type ServerActor,
  type UploadAuthorizationInput,
} from "../src/domain/assetStorage.js";
import type { AssetStorageRepository } from "../src/repositories/assetStorageRepository.js";
import { AssetAuthorizationError, AssetStorageService } from "../src/services/assetStorageService.js";

const sha = "a".repeat(64);
const actor: ServerActor = { userId: "30000000-0000-4000-8000-000000000001", allowedEnvironments: ["homologation"] };

function makeObject(overrides: Partial<AssetObject> = {}): AssetObject {
  return assetObjectSchema.parse({
    id: randomUUID(),
    assetId: "territory-br-forest-landmark-v001",
    assetVersion: "v001",
    environment: "homologation",
    ownerId: actor.userId,
    requestedById: actor.userId,
    bucketId: "blender-assets-incoming",
    storageKey: "incoming/homologation/territory-br-forest-landmark-v001/v001/" + sha + ".blend",
    declaredSha256: sha,
    mimeType: "application/x-blender",
    sizeBytes: 1024,
    state: "pending_upload",
    referencedByGame: false,
    correlationId: randomUUID(),
    auditMetadata: {},
    createdAt: "2026-10-22T10:00:00.000Z",
    updatedAt: "2026-10-22T10:00:00.000Z",
    uploadedAt: null,
    verifiedAt: null,
    expiresAt: "2026-10-29T10:00:00.000Z",
    deletedAt: null,
    ...overrides,
  });
}

class FakeAssetStorageRepository implements AssetStorageRepository {
  readonly objects = new Map<string, AssetObject>();
  lastDownloadExpiry: number | undefined;

  createIncoming(_actor: ServerActor, _input: UploadAuthorizationInput, storageKey: string, expiresAt: Date): Promise<AssetObject> {
    const object = makeObject({ storageKey, expiresAt: expiresAt.toISOString() });
    this.objects.set(object.id, object);
    return Promise.resolve(object);
  }

  getById(id: string): Promise<AssetObject | null> {
    return Promise.resolve(this.objects.get(id) ?? null);
  }

  findExpired(): Promise<AssetObject[]> {
    return Promise.resolve([...this.objects.values()].filter((object) => object.expiresAt !== null && object.state !== "deleted"));
  }

  createSignedUpload(object: AssetObject): Promise<{ path: string; token: string }> {
    return Promise.resolve({ path: object.storageKey, token: "redacted-test-token" });
  }

  createSignedDownload(object: AssetObject, expiresInSeconds: number): Promise<{ signedUrl: string; path: string }> {
    this.lastDownloadExpiry = expiresInSeconds;
    return Promise.resolve({ signedUrl: "https://example.invalid/signed-url", path: object.storageKey });
  }
}

function uploadRequest() {
  const storageKey = buildIncomingStorageKey("homologation", {
    assetId: "territory-br-forest-landmark-v001",
    assetType: "territory_landmark",
    assetVersion: "v001",
    displayName: "Marco da Floresta do Brasil",
    territoryId: "br-forest",
    authorship: { authorName: "TerraVox Art Team", attribution: "Created for TerraVox" },
    license: { identifier: "LicenseRef-TerraVox", name: "TerraVox project asset license" },
  }, sha);
  return {
    environment: "homologation",
    contract: {
      contractVersion: "1.0.0",
      asset: {
        assetId: "territory-br-forest-landmark-v001",
        assetType: "territory_landmark",
        assetVersion: "v001",
        displayName: "Marco da Floresta do Brasil",
        territoryId: "br-forest",
        authorship: { authorName: "TerraVox Art Team", attribution: "Created for TerraVox" },
        license: { identifier: "LicenseRef-TerraVox", name: "TerraVox project asset license" },
      },
      source: { storageKey, sha256: sha, mediaType: "application/x-blender", sizeBytes: 1024 },
      exportProfile: "terravox-web-default",
      idempotencyKey: "b3000000-0000-4000-8000-202610220001",
    },
  };
}

describe("B3.2 private asset storage", () => {
  it("constructs the server-owned canonical key and creates no client-selected path", async () => {
    const repository = new FakeAssetStorageRepository();
    const result = await new AssetStorageService(repository).authorizeBlendUpload(actor, uploadRequest());
    expect(result.assetObject.storageKey).toBe(uploadRequest().contract.source.storageKey);
    expect(result.uploadUrlLifetimeSeconds).toBe(7200);
    expect(JSON.stringify(result)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("rejects a valid-contract but non-canonical arbitrary source key", async () => {
    const request = uploadRequest();
    request.contract.source.storageKey = "incoming/other/asset.blend";
    await expect(new AssetStorageService(new FakeAssetStorageRepository()).authorizeBlendUpload(actor, request)).rejects.toMatchObject({
      code: "ASSET_ACCESS_DENIED",
    } satisfies Partial<AssetAuthorizationError>);
  });

  it("rejects an actor outside the requested environment", async () => {
    const previewActor: ServerActor = { ...actor, allowedEnvironments: ["preview"] };
    await expect(new AssetStorageService(new FakeAssetStorageRepository()).authorizeBlendUpload(previewActor, uploadRequest())).rejects.toMatchObject({
      code: "ASSET_ACCESS_DENIED",
    } satisfies Partial<AssetAuthorizationError>);
  });

  it("denies a derived download to another owner and permits an authorized owner for five minutes", async () => {
    const repository = new FakeAssetStorageRepository();
    const derived = makeObject({
      bucketId: "blender-assets-derived",
      storageKey: "derived/homologation/territory-br-forest-landmark-v001/v001/1.0.0/" + sha + ".glb",
      mimeType: "model/gltf-binary",
      state: "processed",
    });
    repository.objects.set(derived.id, derived);
    const service = new AssetStorageService(repository);
    await expect(service.authorizeDerivedDownload({ ...actor, userId: randomUUID() }, derived.id)).rejects.toMatchObject({
      code: "ASSET_ACCESS_DENIED",
    } satisfies Partial<AssetAuthorizationError>);
    await expect(service.authorizeDerivedDownload(actor, derived.id)).resolves.toMatchObject({ expiresInSeconds: 300 });
    expect(repository.lastDownloadExpiry).toBe(300);
  });

  it("plans only a dry-run cleanup and remains non-destructive across repeated runs", async () => {
    const repository = new FakeAssetStorageRepository();
    const expired = makeObject({ expiresAt: "2026-10-21T00:00:00.000Z" });
    repository.objects.set(expired.id, expired);
    const service = new AssetStorageService(repository);
    const first = await service.planRetentionDryRun(new Date("2026-10-22T00:00:00.000Z"));
    const second = await service.planRetentionDryRun(new Date("2026-10-22T00:00:00.000Z"));
    expect(first.dryRun).toBe(true);
    expect(first.candidates).toEqual(second.candidates);
    expect(repository.objects.get(expired.id)?.state).toBe("pending_upload");
  });
});
