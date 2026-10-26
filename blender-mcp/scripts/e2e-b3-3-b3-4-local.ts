/**
 * Disposable-only B3.3/B3.4 critical-path test. It deliberately needs local
 * Supabase credentials injected by the isolated CI workflow and must never be
 * pointed at a shared project.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildIncomingStorageKey } from "../src/domain/assetStorage.js";
import { createSupabaseAssetProcessingRepository } from "../src/repositories/assetProcessingRepository.js";
import { createSupabaseAssetStorageRepository } from "../src/repositories/assetStorageRepository.js";
import { createSupabaseJobRepository } from "../src/repositories/supabaseJobRepository.js";
import { AssetProcessingService, ProcessingAuthorizationError } from "../src/services/assetProcessingService.js";
import { AssetStorageService } from "../src/services/assetStorageService.js";
import { JobService } from "../src/services/jobService.js";
import { McpAuthService, McpAuthenticationError } from "../src/services/mcpAuthService.js";
import { AssetResolver } from "../src/worker/assetResolver.js";
import { AssetPipelineWorker } from "../src/worker/assetPipelineWorker.js";
import { JobProcessor } from "../src/worker/jobProcessor.js";
import { createLogger } from "../src/lib/logger.js";
import { SpawnProcessRunner } from "../src/worker/processRunner.js";
import { ScriptRegistry } from "../src/worker/scriptRegistry.js";
import { WorkspaceManager } from "../src/worker/workspace.js";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the disposable E2E`);
  return value;
};
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const expectRejected = async (work: () => Promise<unknown>, expected: string): Promise<void> => {
  try { await work(); } catch (error) {
    const code = error instanceof McpAuthenticationError || error instanceof ProcessingAuthorizationError ? error.code : String(error);
    if (code === expected) return;
    throw error;
  }
  throw new Error(`expected rejection ${expected}`);
};

async function main(): Promise<void> {
  const url = required("SUPABASE_URL");
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(url)) throw new Error("E2E accepts only local Supabase URLs");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = required("SUPABASE_ANON_KEY");
  const blenderPath = required("BLENDER_PATH");
  const sourcePath = required("B3_E2E_BLEND_PATH");
  const source = new Uint8Array(await readFile(sourcePath));
  const sourceSha = sha256(source);
  const runId = randomUUID();
  const email = `b33-${runId}@example.invalid`;
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await serviceClient.auth.admin.createUser({ email, password: "B33-local-only-passphrase", email_confirm: true, app_metadata: { terravox_environments: ["homologation"] } });
  if (created.error || !created.data.user) throw new Error("could not create local E2E user");
  const ownerId = created.data.user.id;
  const login = await publicClient.auth.signInWithPassword({ email, password: "B33-local-only-passphrase" });
  if (login.error || !login.data.session) throw new Error("could not obtain local bearer token");
  const auth = new McpAuthService(serviceClient);
  await expectRejected(() => auth.authenticate(undefined), "MCP_UNAUTHENTICATED");
  await expectRejected(() => auth.authenticate("Bearer malformed"), "MCP_UNAUTHENTICATED");
  const actor = await auth.authenticate(`Bearer ${login.data.session.access_token}`);
  if (actor.userId !== ownerId || !actor.allowedEnvironments.includes("homologation")) throw new Error("Bearer actor claims are incorrect");

  const asset = { assetId: `b33-${runId.slice(0, 12)}`, assetType: "territory_landmark" as const, assetVersion: "v001", displayName: "B3.3 Local Cube", territoryId: "br-local", authorship: { authorName: "TerraVox QA", attribution: "Synthetic disposable fixture" }, license: { identifier: "LicenseRef-QA", name: "QA only" } };
  const sourceKey = buildIncomingStorageKey("homologation", asset, sourceSha);
  const contract = { contractVersion: "1.0.0" as const, asset, source: { storageKey: sourceKey, sha256: sourceSha, mediaType: "application/x-blender" as const, sizeBytes: source.byteLength }, exportProfile: "terravox-web-default" as const, idempotencyKey: randomUUID() };
  const storage = new AssetStorageService(createSupabaseAssetStorageRepository(url, serviceKey));
  const sourceObject = await storage.authorizeBlendUpload(actor, { environment: "homologation", contract });
  const upload = await serviceClient.storage.from(sourceObject.assetObject.bucketId).uploadToSignedUrl(sourceObject.signedUpload.path, sourceObject.signedUpload.token, source, { contentType: "application/x-blender" });
  if (upload.error) throw new Error("private source upload failed");
  const marked = await serviceClient.from("blender_asset_objects").update({ state: "uploaded", uploaded_at: new Date().toISOString() }).eq("id", sourceObject.assetObject.id);
  if (marked.error) throw new Error(`source metadata transition failed: ${marked.error.code ?? "UNKNOWN"}`);

  const jobs = new JobService(createSupabaseJobRepository(url, serviceKey));
  const processingService = new AssetProcessingService(createSupabaseAssetProcessingRepository(url, serviceKey), jobs);
  const submitted = await processingService.submit(actor, { sourceObjectId: sourceObject.assetObject.id, environment: "homologation", contract });
  const replay = await processingService.submit(actor, { sourceObjectId: sourceObject.assetObject.id, environment: "homologation", contract });
  if (!submitted.created || replay.created || replay.processing.id !== submitted.processing.id) throw new Error("MCP submission idempotency failed");
  await expectRejected(() => processingService.getForActor({ userId: randomUUID(), allowedEnvironments: ["homologation"] }, submitted.processing.id), "PROCESSING_NOT_FOUND");
  await expectRejected(() => processingService.getForActor({ userId: ownerId, allowedEnvironments: ["preview"] }, submitted.processing.id), "PROCESSING_NOT_FOUND");

  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "terravox-b33-e2e-"));
  try {
    const logger = createLogger({ test: "b3_3_b3_4_local" });
    const repository = createSupabaseJobRepository(url, serviceKey);
    const runner = new SpawnProcessRunner();
    const scripts = new ScriptRegistry(path.resolve("tools/blender"));
    await scripts.verify();
    const workspaces = new WorkspaceManager(workspaceRoot, logger);
    const pipeline = new AssetPipelineWorker({ processings: createSupabaseAssetProcessingRepository(url, serviceKey), objects: (await import("../src/repositories/processingObjectStore.js")).createSupabaseProcessingObjectStore(url, serviceKey), workspaces, scripts, runner, blenderPath, timeoutMs: 120_000 });
    const processor = new JobProcessor({ repository, runner, logger, assets: new AssetResolver(path.resolve("assets/blender")), scripts, workspaces, pipeline, config: { workerId: "b33-local-e2e", pollIntervalMs: 100, leaseSeconds: 20, heartbeatIntervalMs: 1_000, maxAttempts: 1, retryDelayMs: 0, shutdownGraceMs: 5_000, workspaceRoot, staleWorkspaceMaxAgeMs: 60_000, requireBlenderAtStartup: true, blenderPath, blenderTimeoutMs: 120_000, killGraceMs: 2_000, maxOutputBytes: 262_144, maxResultBytes: 1_048_576, assetsDir: path.resolve("assets/blender"), scriptsDir: path.resolve("tools/blender") } });
    const claimed = await jobs.claimNext("b33-local-e2e", 20);
    if (!claimed) throw new Error("B2 queue did not yield the submitted processing job");
    if (await processor.process(claimed, new AbortController().signal) !== "completed") throw new Error("B2 worker did not complete the pipeline job");
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
  const completed = await processingService.getForActor(actor, submitted.processing.id);
  if (completed.processing.state !== "completed" || completed.artifacts.length !== 3 || completed.artifacts.some((artifact) => artifact.state !== "verified" || !artifact.assetObjectId)) throw new Error("processing artifacts were not fully verified");
  const glb = completed.artifacts.find((artifact) => artifact.kind === "glb");
  if (!glb?.assetObjectId) throw new Error("GLB artifact missing");
  const download = await storage.authorizeDerivedDownload(actor, glb.assetObjectId);
  const response = await fetch(download.signedDownload.signedUrl);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!response.ok || bytes.byteLength < 20 || Buffer.from(bytes).readUInt32LE(0) !== 0x46546c67) throw new Error("authorized GLB download is not structurally valid");
  console.log(JSON.stringify({ e2e: "PASS", processing: completed.processing.id, artifacts: completed.artifacts.map((artifact) => ({ kind: artifact.kind, state: artifact.state })), authorizedDownload: "PASS", crossOwner: "DENIED", crossEnvironment: "DENIED", unauthenticated: "DENIED" }));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
