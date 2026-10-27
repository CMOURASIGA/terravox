/**
 * Disposable-only B3.3/B3.4 critical-path test. It deliberately needs local
 * Supabase credentials injected by the isolated CI workflow and must never be
 * pointed at a shared project.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
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
import { createMcpServer } from "../src/server/createMcpServer.js";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the disposable E2E`);
  return value;
};
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const localEnvironmentClaim = (metadata: unknown): string[] => {
  if (!metadata || typeof metadata !== "object") return [];
  const value = (metadata as Record<string, unknown>).terravox_environments;
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
};
const expectRejected = async (work: () => Promise<unknown>, expected: string): Promise<void> => {
  try { await work(); } catch (error) {
    const code = error instanceof McpAuthenticationError || error instanceof ProcessingAuthorizationError
      ? error.code
      : error instanceof Error
        ? error.message
        : String(error);
    if (code === expected) return;
    throw error;
  }
  throw new Error(`expected rejection ${expected}`);
};
const mcpToolResultSchema = z.object({
  processingId: z.uuid().optional(),
  state: z.string().optional(),
  created: z.boolean().optional(),
  correlationId: z.uuid().optional(),
  processing: z.unknown().optional(),
  artifacts: z.array(z.unknown()).optional(),
  signedUrl: z.url().optional(),
  expiresInSeconds: z.number().int().positive().optional(),
  path: z.string().optional(),
}).passthrough();

async function callAuthenticatedMcp(actor: Parameters<typeof createMcpServer>[1], name: string, args: Record<string, unknown>) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(undefined, actor);
  const client = new Client({ name: "terravox-disposable-e2e", version: "0.1.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`MCP_TOOL_REJECTED:${name}`);
    return mcpToolResultSchema.parse(result.structuredContent);
  } finally {
    await client.close();
    await server.close();
  }
}

async function main(): Promise<void> {
  const scope = process.env.B3_E2E_SCOPE ?? "full";
  if (scope !== "full" && scope !== "auth-storage") throw new Error("B3_E2E_SCOPE must be full or auth-storage");
  const url = required("SUPABASE_URL");
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("E2E accepts only local Supabase URLs");
  }
  if (parsedUrl.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
    throw new Error("E2E accepts only local Supabase URLs");
  }
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
  // Local GoTrue can ignore app_metadata at creation. Persist it explicitly so
  // the test exercises the same authorization claim read by McpAuthService.
  const authorized = await serviceClient.auth.admin.updateUserById(ownerId, {
    app_metadata: { terravox_environments: ["homologation"] },
  });
  if (authorized.error || !authorized.data.user) {
    throw new Error("could not authorize local E2E user environment");
  }
  const administrativeRead = await serviceClient.auth.admin.getUserById(ownerId);
  if (administrativeRead.error || !administrativeRead.data.user) {
    throw new Error("could not read local E2E user after authorization update");
  }
  const login = await publicClient.auth.signInWithPassword({ email, password: "B33-local-only-passphrase" });
  if (login.error || !login.data.session) throw new Error("could not obtain local bearer token");
  const tokenRead = await serviceClient.auth.getUser(login.data.session.access_token);
  if (tokenRead.error || !tokenRead.data.user) throw new Error("could not read local E2E bearer user");
  const adminEnvironments = localEnvironmentClaim(administrativeRead.data.user.app_metadata);
  const tokenEnvironments = localEnvironmentClaim(tokenRead.data.user.app_metadata);
  console.log(JSON.stringify({
    localAuthFixture: "VERIFIED",
    createdUserId: ownerId,
    adminUpdate: "SUCCESS",
    administrativeUserId: administrativeRead.data.user.id,
    administrativeClaimPresent: adminEnvironments.includes("homologation"),
    tokenUserId: tokenRead.data.user.id,
    tokenClaimPresent: tokenEnvironments.includes("homologation"),
    sameUser: ownerId === administrativeRead.data.user.id && ownerId === tokenRead.data.user.id,
    localInstance: parsedUrl.origin,
  }));
  if (ownerId !== administrativeRead.data.user.id || ownerId !== tokenRead.data.user.id ||
      !adminEnvironments.includes("homologation") || !tokenEnvironments.includes("homologation")) {
    throw new Error("local E2E authorization claim was not persisted");
  }
  const auth = new McpAuthService(serviceClient);
  await expectRejected(() => auth.authenticate(undefined), "MCP_UNAUTHENTICATED");
  await expectRejected(() => auth.authenticate("Bearer malformed"), "MCP_UNAUTHENTICATED");
  const actor = await auth.authenticate(`Bearer ${login.data.session.access_token}`);
  if (actor.userId !== ownerId || !actor.allowedEnvironments.includes("homologation")) throw new Error("Bearer actor claims are incorrect");
  console.log(JSON.stringify({ e2eGate: "authentication-and-environment-authorization", status: "PASS" }));
  const createLocalActor = async (suffix: string, environments: string[]) => {
    const localEmail = `b33-${suffix}-${runId}@example.invalid`;
    const localCreated = await serviceClient.auth.admin.createUser({
      email: localEmail,
      password: "B33-local-only-passphrase",
      email_confirm: true,
    });
    if (localCreated.error || !localCreated.data.user) throw new Error(`could not create local ${suffix} actor`);
    const updated = await serviceClient.auth.admin.updateUserById(localCreated.data.user.id, {
      app_metadata: { terravox_environments: environments },
    });
    if (updated.error) throw new Error(`could not authorize local ${suffix} actor`);
    const localLogin = await publicClient.auth.signInWithPassword({ email: localEmail, password: "B33-local-only-passphrase" });
    if (localLogin.error || !localLogin.data.session) throw new Error(`could not authenticate local ${suffix} actor`);
    return auth.authenticate(`Bearer ${localLogin.data.session.access_token}`);
  };
  const crossOwnerActor = await createLocalActor("other-owner", ["homologation"]);
  const crossEnvironmentActor = await createLocalActor("other-environment", ["preview"]);

  const asset = { assetId: `b33-${runId.slice(0, 12)}`, assetType: "territory_landmark" as const, assetVersion: "v001", displayName: "B3.3 Local Cube", territoryId: "br-local", authorship: { authorName: "TerraVox QA", attribution: "Synthetic disposable fixture" }, license: { identifier: "LicenseRef-QA", name: "QA only" } };
  const sourceKey = buildIncomingStorageKey("homologation", asset, sourceSha);
  const contract = { contractVersion: "1.0.0" as const, asset, source: { storageKey: sourceKey, sha256: sourceSha, mediaType: "application/x-blender" as const, sizeBytes: source.byteLength }, exportProfile: "terravox-web-default" as const, idempotencyKey: randomUUID() };
  const storage = new AssetStorageService(createSupabaseAssetStorageRepository(url, serviceKey));
  let sourceObject: Awaited<ReturnType<typeof storage.authorizeBlendUpload>>;
  try {
    sourceObject = await storage.authorizeBlendUpload(actor, { environment: "homologation", contract });
  } catch (error) {
    const persisted = await serviceClient
      .from("blender_asset_objects")
      .select("id,correlation_id")
      .eq("storage_key", sourceKey)
      .maybeSingle();
    const isUuid = (value: unknown): boolean =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const persistedIdentifiers = z
      .object({ id: z.unknown(), correlation_id: z.unknown() })
      .strict()
      .safeParse(persisted.data);
    const persistedId = persistedIdentifiers.success ? persistedIdentifiers.data.id : null;
    const persistedCorrelationId = persistedIdentifiers.success ? persistedIdentifiers.data.correlation_id : null;
    console.log(JSON.stringify({
      storageAuthorizationDiagnostic: "FAILED",
      persistedRowFound: persistedIdentifiers.success,
      persistedId: typeof persistedId === "string" ? persistedId : null,
      persistedIdIsUuid: isUuid(persistedId),
      persistedCorrelationId: typeof persistedCorrelationId === "string" ? persistedCorrelationId : null,
      persistedCorrelationIdIsUuid: isUuid(persistedCorrelationId),
      persistenceReadError: persisted.error?.code ?? null,
    }));
    throw error;
  }
  const upload = await serviceClient.storage.from(sourceObject.assetObject.bucketId).uploadToSignedUrl(sourceObject.signedUpload.path, sourceObject.signedUpload.token, source, { contentType: "application/x-blender" });
  if (upload.error) throw new Error("private source upload failed");
  const marked = await serviceClient.from("blender_asset_objects").update({ state: "uploaded", uploaded_at: new Date().toISOString() }).eq("id", sourceObject.assetObject.id);
  if (marked.error) throw new Error(`source metadata transition failed: ${marked.error.code ?? "UNKNOWN"}`);
  const privateSource = await serviceClient.storage.from(sourceObject.assetObject.bucketId).download(sourceObject.assetObject.storageKey);
  if (privateSource.error || sha256(new Uint8Array(await privateSource.data.arrayBuffer())) !== sourceSha) {
    throw new Error("private source storage integrity check failed");
  }
  const publicSource = await publicClient.storage.from(sourceObject.assetObject.bucketId).download(sourceObject.assetObject.storageKey);
  if (!publicSource.error) throw new Error("private source object was readable without authorization");
  console.log(JSON.stringify({ e2eGate: "private-source-storage-and-integrity", status: "PASS" }));
  if (scope === "auth-storage") {
    console.log(JSON.stringify({ e2e: "PASS", scope, auth: "PASS", privateStorage: "PASS", downstream: "NOT_RUN" }));
    return;
  }

  const jobs = new JobService(createSupabaseJobRepository(url, serviceKey));
  const processingService = new AssetProcessingService(createSupabaseAssetProcessingRepository(url, serviceKey), jobs);
  let submitted: z.infer<typeof mcpToolResultSchema>;
  try {
    submitted = await callAuthenticatedMcp(actor, "blender.submit_asset_processing", {
      sourceObjectId: sourceObject.assetObject.id,
      environment: "homologation",
      contract,
    });
  } catch (error) {
    const persisted = await serviceClient
      .from("blender_asset_processings")
      .select("id,correlation_id")
      .eq("source_object_id", sourceObject.assetObject.id)
      .maybeSingle();
    const isUuid = (value: unknown): boolean =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const persistedIdentifiers = z
      .object({ id: z.unknown(), correlation_id: z.unknown() })
      .strict()
      .safeParse(persisted.data);
    const persistedId = persistedIdentifiers.success ? persistedIdentifiers.data.id : null;
    const persistedCorrelationId = persistedIdentifiers.success ? persistedIdentifiers.data.correlation_id : null;
    console.log(JSON.stringify({
      processingSubmissionDiagnostic: "FAILED",
      persistedRowFound: persistedIdentifiers.success,
      persistedId: typeof persistedId === "string" ? persistedId : null,
      persistedIdIsUuid: isUuid(persistedId),
      persistedCorrelationId: typeof persistedCorrelationId === "string" ? persistedCorrelationId : null,
      persistedCorrelationIdIsUuid: isUuid(persistedCorrelationId),
      persistenceReadError: persisted.error?.code ?? null,
    }));
    throw error;
  }
  const submittedId = z.uuid().parse(submitted.processingId);
  const replay = await callAuthenticatedMcp(actor, "blender.submit_asset_processing", {
    sourceObjectId: sourceObject.assetObject.id,
    environment: "homologation",
    contract,
  });
  if (submitted.created !== true || replay.created !== false || replay.processingId !== submittedId) throw new Error("MCP submission idempotency failed");
  await expectRejected(
    () => callAuthenticatedMcp(crossOwnerActor, "blender.get_asset_processing", { processingId: submittedId }),
    "MCP_TOOL_REJECTED:blender.get_asset_processing",
  );
  await expectRejected(
    () => callAuthenticatedMcp(crossEnvironmentActor, "blender.get_asset_processing", { processingId: submittedId }),
    "MCP_TOOL_REJECTED:blender.get_asset_processing",
  );
  await expectRejected(() => processingService.getForActor({ userId: randomUUID(), allowedEnvironments: ["homologation"] }, submittedId), "PROCESSING_NOT_FOUND");
  await expectRejected(() => processingService.getForActor({ userId: ownerId, allowedEnvironments: ["preview"] }, submittedId), "PROCESSING_NOT_FOUND");

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
  const completed = await callAuthenticatedMcp(actor, "blender.get_asset_processing", { processingId: submittedId });
  const completedProcessing = z.object({ state: z.string() }).passthrough().parse(completed.processing);
  const completedArtifacts = z.array(z.object({ kind: z.string(), state: z.string(), assetObjectId: z.uuid().nullable().optional() }).passthrough()).parse(completed.artifacts);
  if (completedProcessing.state !== "completed" || completedArtifacts.length !== 3 || completedArtifacts.some((artifact) => artifact.state !== "verified" || !artifact.assetObjectId)) throw new Error("processing artifacts were not fully verified");
  const validation = await callAuthenticatedMcp(actor, "blender.get_asset_validation_result", { processingId: submittedId });
  if (validation.state !== "completed") throw new Error("MCP validation result is not completed");
  const artifactList = await callAuthenticatedMcp(actor, "blender.get_asset_artifacts", { processingId: submittedId });
  if (z.array(z.unknown()).parse(artifactList.artifacts).length !== 3) throw new Error("MCP artifact list is incomplete");
  const download = await callAuthenticatedMcp(actor, "blender.create_asset_artifact_download", { processingId: submittedId, kind: "glb" });
  const signedUrl = z.url().parse(download.signedUrl);
  const response = await fetch(signedUrl);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!response.ok || bytes.byteLength < 20 || Buffer.from(bytes).readUInt32LE(0) !== 0x46546c67) throw new Error("authorized GLB download is not structurally valid");
  console.log(JSON.stringify({ e2e: "PASS", processing: submittedId, artifacts: completedArtifacts.map((artifact) => ({ kind: artifact.kind, state: artifact.state })), authorizedDownload: "PASS", crossOwner: "DENIED", crossEnvironment: "DENIED", unauthenticated: "DENIED" }));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
