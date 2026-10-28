/**
 * Disposable-only B2/PostgREST boundary contract.
 *
 * This probe is intentionally independent from the B3 processing flow. It
 * proves that UUIDs accepted by PostgreSQL are persisted, returned by REST,
 * and accepted by the production JobService mapper before the full E2E runs.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseJobRepository } from "../src/repositories/supabaseJobRepository.js";
import { JobService } from "../src/services/jobService.js";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the disposable B2 REST probe`);
  return value;
};

const localUrl = (): string => {
  const value = required("SUPABASE_URL");
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("B2 REST probe accepts only a local disposable Supabase URL");
  }
  return value;
};

const rawJobSchema = z.object({
  id: z.uuid(),
  correlation_id: z.uuid(),
  operation: z.literal("export_glb"),
  status: z.literal("queued"),
  asset_id: z.string().min(3),
}).passthrough();

const assertEqual = (actual: string, expected: string, label: string): void => {
  if (actual !== expected) throw new Error(`B2 REST contract mismatch: ${label}`);
};

async function main(): Promise<void> {
  const url = localUrl();
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = randomUUID();
  const directId = randomUUID();
  const directCorrelationId = randomUUID();
  const assetId = `b2-contract-${run.slice(0, 12)}`;

  const inserted = await client.from("blender_jobs").insert({
    id: directId,
    operation: "export_glb",
    status: "queued",
    asset_id: assetId,
    payload: { profile: "terravox-web-default", contractProbe: true },
    correlation_id: directCorrelationId,
  }).select("*").single();
  if (inserted.error) throw new Error(`B2 REST direct insert failed (${inserted.error.code ?? "UNKNOWN"})`);
  const persisted = rawJobSchema.parse(inserted.data);
  assertEqual(persisted.id, directId, "direct id persistence/REST return");
  assertEqual(persisted.correlation_id, directCorrelationId, "direct correlation persistence/REST return");

  const reloaded = await client.from("blender_jobs").select("*").eq("id", directId).single();
  if (reloaded.error) throw new Error(`B2 REST direct reload failed (${reloaded.error.code ?? "UNKNOWN"})`);
  const reloadedRow = rawJobSchema.parse(reloaded.data);
  assertEqual(reloadedRow.id, directId, "direct id reload");
  assertEqual(reloadedRow.correlation_id, directCorrelationId, "direct correlation reload");

  const serviceCorrelationId = randomUUID();
  const jobService = new JobService(createSupabaseJobRepository(url, serviceKey));
  const created = await jobService.createAssetPipelineExport({
    assetId,
    processingId: randomUUID(),
    sourceObjectId: randomUUID(),
    correlationId: serviceCorrelationId,
  });
  if (!z.uuid().safeParse(created.id).success || !z.uuid().safeParse(created.correlationId).success) {
    throw new Error("B2 JobService mapper returned malformed UUIDs");
  }
  assertEqual(created.correlationId, serviceCorrelationId, "JobService correlation return");
  const fetched = await jobService.getById(created.id);
  if (!fetched) throw new Error("B2 JobService could not reload created job");
  assertEqual(fetched.id, created.id, "JobService id reload");
  assertEqual(fetched.correlationId, serviceCorrelationId, "JobService correlation reload");

  // The Worker enters the queue through the RPC, not a direct REST read. Keep
  // that boundary in this independent probe so a malformed RPC row cannot be
  // mistaken for a processing/MCP failure later in the E2E.
  const claimed = await jobService.claimNext("b2-contract-probe", 20);
  if (!claimed) throw new Error("B2 claim RPC did not return a queued job");
  if (!z.uuid().safeParse(claimed.id).success || !z.uuid().safeParse(claimed.correlationId).success) {
    throw new Error("B2 claim RPC returned malformed UUIDs");
  }
  if (claimed.id !== directId && claimed.id !== created.id) {
    throw new Error("B2 claim RPC returned an unexpected job");
  }

  // Keep this independent probe from leaving synthetic queue entries that a
  // subsequent Worker/E2E gate could consume. Terminal cancellation is a
  // real transition and keeps the queue contract under test.
  for (const jobId of [directId, created.id]) {
    const queuedOrClaimed = await jobService.getById(jobId);
    if (queuedOrClaimed?.status === "queued" || queuedOrClaimed?.status === "processing") {
      await jobService.updateState(queuedOrClaimed, "cancelled");
    }
  }

  console.log(JSON.stringify({
    b2RestContract: "PASS",
    directPersistenceAndRest: "PASS",
    productionRepositoryMapping: "PASS",
    jobServiceRoundTrip: "PASS",
    claimRpcRoundTrip: "PASS",
    disposableOnly: true,
  }));
}

void main();
