import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assetManifestSchema } from "../domain/assetContract.js";
import { TERRAVOX_WEB_DEFAULT_PROFILE, validateAssetMetrics } from "../domain/assetProfile.js";
import { validationReportSchema, type AssetProcessingRecord, type ValidationReport } from "../domain/assetProcessing.js";
import type { AssetProcessingRepository } from "../repositories/assetProcessingRepository.js";
import type { ProcessingObjectStore } from "../repositories/processingObjectStore.js";
import { WorkerError } from "./errors.js";
import type { ProcessRunner } from "./processRunner.js";
import type { ScriptRegistry } from "./scriptRegistry.js";
import type { Workspace, WorkspaceManager } from "./workspace.js";

const MAX_SOURCE_BYTES = 64 * 1024 * 1024;

function sha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function compactError(error: unknown): { code: string; message: string } {
  if (error instanceof WorkerError) return { code: error.code, message: error.message };
  return { code: "ASSET_VALIDATION_FAILED", message: error instanceof Error ? error.message.slice(0, 500) : "Unknown pipeline error" };
}

/**
 * B3.3 worker path. It accepts only database IDs and invokes only allowlisted scripts.
 * It intentionally has no route and is executed by the already isolated B2 worker process.
 */
export class AssetPipelineWorker {
  constructor(private readonly deps: {
    processings: AssetProcessingRepository;
    objects: ProcessingObjectStore;
    workspaces: WorkspaceManager;
    scripts: ScriptRegistry;
    runner: ProcessRunner;
    blenderPath: string;
    timeoutMs: number;
  }) {}

  getProcessing(id: string): Promise<AssetProcessingRecord | null> {
    return this.deps.processings.getById(id);
  }

  async process(processing: AssetProcessingRecord, signal: AbortSignal): Promise<void> {
    let workspace: Workspace | undefined;
    try {
      await this.deps.processings.setState(processing.id, "queued", "processing");
      workspace = await this.deps.workspaces.create(processing.id);
      const source = await this.deps.objects.downloadSource(processing.sourceObjectId);
      if (source.object.ownerId !== processing.ownerId || source.object.environment !== processing.environment || source.object.declaredSha256 !== processing.sourceSha256) {
        throw new WorkerError("SOURCE_HASH_MISMATCH", "Source metadata does not match processing identity");
      }
      if (source.bytes.byteLength > MAX_SOURCE_BYTES || source.bytes.byteLength !== source.object.sizeBytes) {
        throw new WorkerError("SOURCE_TOO_LARGE", "Source size violates the worker limit");
      }
      if (sha256(source.bytes) !== processing.sourceSha256) throw new WorkerError("SOURCE_HASH_MISMATCH", "Source SHA-256 does not match declared metadata");
      await writeFile(workspace.inputPath, source.bytes, { mode: 0o600, flag: "wx" });

      const report = await this.validate(workspace, processing, signal);
      const outcome = validateAssetMetrics(report.metrics, TERRAVOX_WEB_DEFAULT_PROFILE);
      report.valid = outcome.valid && report.errors.length === 0;
      report.errors.push(...outcome.violations.map((violation) => ({
        code: violation.code, message: `${String(violation.actual)} exceeds or violates ${String(violation.limit)}`,
      })));
      if (!report.valid) throw new WorkerError("ASSET_VALIDATION_FAILED", "Source does not meet terravox-web-default", { errors: report.errors });

      await this.deps.processings.setState(processing.id, "processing", "verifying_output");
      const glb = await this.exportGlb(workspace, processing, signal);
      const glbMetrics: ValidationReport = { ...report, metrics: { ...report.metrics, glbBytes: glb.byteLength } };
      const exported = validateAssetMetrics(glbMetrics.metrics, TERRAVOX_WEB_DEFAULT_PROFILE);
      if (!exported.valid) throw new WorkerError("OUTPUT_VALIDATION_FAILED", "Exported GLB violates the profile", { violations: exported.violations });

      const reportBytes = new TextEncoder().encode(JSON.stringify(glbMetrics));
      const manifest = assetManifestSchema.parse({
        manifestVersion: "1.0.0", contractVersion: processing.sourceContract.contractVersion,
        asset: processing.sourceContract.asset,
        profile: { name: "terravox-web-default", version: "1.0.0" },
        source: { storageKey: source.object.storageKey, sha256: processing.sourceSha256, sizeBytes: source.bytes.byteLength },
        output: { storageKey: `derived/${processing.environment}/${processing.assetId}/${processing.assetVersion}/1.0.0/${sha256(glb)}.glb`, sha256: sha256(glb), sizeBytes: glb.byteLength, mediaType: "model/gltf-binary" },
        idempotencyKey: processing.idempotencyKey, idempotencyFingerprint: processing.idempotencyFingerprint, createdAt: new Date().toISOString(),
      });
      const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
      const artifacts = await this.deps.processings.listArtifacts(processing.id);
      for (const [kind, bytes, mediaType] of [["glb", glb, "model/gltf-binary"], ["report", reportBytes, "application/json"], ["manifest", manifestBytes, "application/json"]] as const) {
        const artifact = artifacts.find((item) => item.kind === kind);
        if (!artifact) throw new WorkerError("INTERNAL_ERROR", "Required artifact plan missing");
        await this.deps.processings.setArtifactState(artifact.id, "planned", "uploading");
        const stored = await this.deps.objects.uploadDerived({ processing, kind, bytes, mediaType });
        const uploading = (await this.deps.processings.listArtifacts(processing.id)).find((item) => item.id === artifact.id);
        if (!uploading) throw new WorkerError("INTERNAL_ERROR", "Artifact disappeared during upload");
        await this.deps.processings.setArtifactState(uploading.id, "uploading", "stored", { storageKey: stored.storageKey, contentSha256: stored.declaredSha256, sizeBytes: stored.sizeBytes, assetObjectId: stored.id });
        const storedArtifact = (await this.deps.processings.listArtifacts(processing.id)).find((item) => item.id === artifact.id);
        if (!storedArtifact) throw new WorkerError("INTERNAL_ERROR", "Artifact disappeared during verification");
        await this.deps.processings.setArtifactState(storedArtifact.id, "stored", "verified", { storageKey: stored.storageKey, contentSha256: stored.declaredSha256, sizeBytes: stored.sizeBytes, assetObjectId: stored.id });
      }
      await this.deps.processings.setState(processing.id, "verifying_output", "completed", { error: null });
    } catch (error) {
      const current = await this.deps.processings.getById(processing.id);
      if (current && !["completed", "failed", "cancelled"].includes(current.state)) {
        await this.deps.processings.setState(current.id, current.state, "failed", { error: compactError(error) });
      }
      throw error;
    } finally {
      if (workspace) await this.deps.workspaces.cleanup(workspace);
    }
  }

  private async invoke(workspace: Workspace, scriptName: "validate_asset" | "export_glb", processing: AssetProcessingRecord, signal: AbortSignal, extra: string[] = []): Promise<unknown> {
    const script = this.deps.scripts.forOperation(scriptName);
    const result = await this.deps.runner.run({ command: this.deps.blenderPath, cwd: workspace.dir, signal, timeoutMs: this.deps.timeoutMs, killGraceMs: 2_000, maxOutputBytes: 32_768,
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: workspace.dir, TMPDIR: workspace.dir, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" },
      args: ["--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1", workspace.inputPath, "--python", script.absolutePath, "--", "--output", workspace.outputPath, "--correlation-id", processing.correlationId, ...extra],
    });
    if (result.spawnError || result.timedOut || result.aborted || result.exitCode !== 0) throw new WorkerError(result.timedOut ? "TIMEOUT" : scriptName === "export_glb" ? "EXPORT_FAILED" : "BLEND_OPEN_FAILED", "Blender validation/export process failed");
    return JSON.parse(await readFile(workspace.outputPath, "utf8")) as unknown;
  }

  private async validate(workspace: Workspace, processing: AssetProcessingRecord, signal: AbortSignal): Promise<ValidationReport> {
    const raw = await this.invoke(workspace, "validate_asset", processing, signal);
    const candidate = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const parsed = validationReportSchema.safeParse({ ...candidate, valid: false });
    if (!parsed.success || parsed.data.correlationId !== processing.correlationId) throw new WorkerError("BLEND_OPEN_FAILED", "Validation report is malformed");
    return parsed.data;
  }

  private async exportGlb(workspace: Workspace, processing: AssetProcessingRecord, signal: AbortSignal): Promise<Uint8Array> {
    const output = path.join(workspace.dir, "output", "asset.glb");
    await this.invoke(workspace, "export_glb", processing, signal, ["--glb-output", output]);
    const info = await stat(output);
    if (info.size <= 0) throw new WorkerError("EXPORT_FAILED", "GLB output is empty");
    return new Uint8Array(await readFile(output));
  }
}
