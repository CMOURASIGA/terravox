import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getEnv } from "../config/env.js";
import { assetProcessingInputSchema } from "../domain/assetContract.js";
import { assetEnvironmentSchema, type ServerActor } from "../domain/assetStorage.js";
import { artifactKindSchema } from "../domain/assetProcessing.js";
import { assetIdSchema, exportProfileSchema, jobIdSchema } from "../domain/job.js";
import { logger } from "../lib/logger.js";
import { JobService } from "../services/jobService.js";
import { getAssetProcessingService, getAssetStorageService, getJobService } from "../services/serviceContainer.js";

export const MCP_TOOL_NAMES = [
  "blender.health",
  "blender.export_glb",
  "blender.get_job_status",
 ] as const;

export const B3_4_MCP_TOOL_NAMES = [
  "blender.submit_asset_processing",
  "blender.get_asset_processing",
  "blender.get_asset_artifacts",
  "blender.create_asset_artifact_download",
  "blender.get_asset_validation_result",
] as const;

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export function createMcpServer(jobService: JobService = getJobService(), actor?: ServerActor): McpServer {
  const env = getEnv();
  const server = new McpServer({
    name: env.MCP_SERVER_NAME,
    version: env.MCP_SERVER_VERSION,
  });

  server.registerTool(
    "blender.health",
    {
      title: "Blender MCP health",
      description: "Reports the MCP, persistent job store and worker configuration status.",
      inputSchema: {},
      outputSchema: {
        status: z.literal("ok"),
        server: z.string(),
        version: z.string(),
        jobStore: z.object({ type: z.literal("supabase-postgres"), status: z.literal("ok") }),
        worker: z.object({ status: z.literal("not-configured") }),
      },
    },
    async () =>
      toolResult({
        status: "ok",
        server: env.MCP_SERVER_NAME,
        version: env.MCP_SERVER_VERSION,
        jobStore: await jobService.health(),
        worker: { status: "not-configured" },
      }),
  );

  server.registerTool(
    "blender.export_glb",
    {
      title: "Queue simulated GLB export job",
      description: "Persists a queued B1 simulation job. No Blender process is executed.",
      inputSchema: {
        assetId: assetIdSchema.describe("Backend asset identifier, never a filesystem path."),
        exportProfile: exportProfileSchema.default("terravox-default"),
      },
      outputSchema: {
        jobId: jobIdSchema,
        status: z.literal("queued"),
        correlationId: jobIdSchema,
        simulated: z.literal(true),
      },
    },
    async ({ assetId, exportProfile }) => {
      const job = await jobService.createSimulatedExport({
        assetId,
        exportProfile,
        correlationId: randomUUID(),
      });

      return toolResult({
        jobId: job.id,
        status: job.status,
        correlationId: job.correlationId,
        simulated: true,
      });
    },
  );

  server.registerTool(
    "blender.get_job_status",
    {
      title: "Get Blender job status",
      description: "Returns a persistent B1 job by identifier.",
      inputSchema: { jobId: jobIdSchema },
    },
    async ({ jobId }) => {
      const job = await jobService.getById(jobId);
      if (!job) {
        logger.warn("job.not_found", { jobId });
        return {
          content: [{ type: "text", text: JSON.stringify({ code: "JOB_NOT_FOUND", jobId }) }],
          isError: true,
        };
      }

      return toolResult({ job });
    },
  );

  if (!actor) return server;
  const processingService = getAssetProcessingService();
  const storageService = getAssetStorageService();
  const processingId = z.uuid();

  server.registerTool(
    "blender.submit_asset_processing",
    {
      title: "Submit private Blender asset processing",
      description: "Creates or returns an idempotent B3 processing request. Only metadata and IDs are accepted.",
      inputSchema: { sourceObjectId: z.uuid(), environment: assetEnvironmentSchema, contract: assetProcessingInputSchema },
      outputSchema: { processingId, state: z.enum(["pending_verification", "queued", "failed"]), created: z.boolean(), correlationId: z.uuid() },
    },
    async (input) => {
      const result = await processingService.submit(actor, input);
      return toolResult({ processingId: result.processing.id, state: result.processing.state, created: result.created, correlationId: result.processing.correlationId });
    },
  );

  server.registerTool(
    "blender.get_asset_processing",
    { title: "Get authorized asset processing", description: "Returns owner-scoped processing state and audit-safe error metadata.", inputSchema: { processingId }, outputSchema: { processing: z.unknown(), artifacts: z.array(z.unknown()) } },
    async ({ processingId: id }) => toolResult(await processingService.getForActor(actor, id)),
  );

  server.registerTool(
    "blender.get_asset_artifacts",
    { title: "Get authorized artifact metadata", description: "Lists owner-scoped artifact states without signed URLs.", inputSchema: { processingId }, outputSchema: { artifacts: z.array(z.unknown()) } },
    async ({ processingId: id }) => {
      const result = await processingService.getForActor(actor, id);
      return toolResult({ artifacts: result.artifacts });
    },
  );

  server.registerTool(
    "blender.create_asset_artifact_download",
    { title: "Create temporary artifact download", description: "Creates a short-lived owner-authorized signed URL. The URL is not logged.", inputSchema: { processingId, kind: artifactKindSchema }, outputSchema: { expiresInSeconds: z.number().int().positive(), signedUrl: z.url(), path: z.string() } },
    async ({ processingId: id, kind }) => {
      const result = await processingService.getForActor(actor, id);
      const artifact = result.artifacts.find((item) => item.kind === kind && item.state === "verified" && item.assetObjectId);
      if (!artifact?.assetObjectId) return { content: [{ type: "text", text: JSON.stringify({ code: "ARTIFACT_NOT_AVAILABLE" }) }], isError: true };
      // Intentionally do not log the return value: it contains a capability URL.
      const download = await storageService.authorizeDerivedDownload(actor, artifact.assetObjectId);
      return toolResult({ ...download.signedDownload, expiresInSeconds: download.expiresInSeconds });
    },
  );

  server.registerTool(
    "blender.get_asset_validation_result",
    { title: "Get asset validation outcome", description: "Returns processing and artifact states, including sanitized failure codes.", inputSchema: { processingId }, outputSchema: { state: z.string(), lastError: z.unknown(), artifacts: z.array(z.unknown()) } },
    async ({ processingId: id }) => {
      const result = await processingService.getForActor(actor, id);
      return toolResult({ state: result.processing.state, lastError: result.processing.lastError, artifacts: result.artifacts });
    },
  );

  return server;
}
