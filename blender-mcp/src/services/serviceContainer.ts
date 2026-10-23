import { getEnv } from "../config/env.js";
import { createSupabaseAssetStorageRepository } from "../repositories/assetStorageRepository.js";
import { createSupabaseJobRepository } from "../repositories/supabaseJobRepository.js";
import { AssetStorageService } from "./assetStorageService.js";
import { JobService } from "./jobService.js";

let cachedJobService: JobService | undefined;
let cachedAssetStorageService: AssetStorageService | undefined;

export function getJobService(): JobService {
  if (!cachedJobService) {
    const env = getEnv();
    cachedJobService = new JobService(
      createSupabaseJobRepository(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
    );
  }
  return cachedJobService;
}

/**
 * Server-only B3.2 service. It intentionally has no MCP tool or public route
 * yet; exposing an asset workflow belongs to the separately authorized B3.4.
 */
export function getAssetStorageService(): AssetStorageService {
  if (!cachedAssetStorageService) {
    const env = getEnv();
    cachedAssetStorageService = new AssetStorageService(
      createSupabaseAssetStorageRepository(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
    );
  }
  return cachedAssetStorageService;
}

export function resetServiceContainerForTests(): void {
  cachedJobService = undefined;
  cachedAssetStorageService = undefined;
}
