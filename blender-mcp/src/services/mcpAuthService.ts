import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { serverActorSchema, type ServerActor } from "../domain/assetStorage.js";

const claimsSchema = z.object({ terravox_environments: z.array(z.enum(["homologation", "preview", "production"])).min(1).max(3) }).strict();

export class McpAuthenticationError extends Error {
  constructor(public readonly code: "MCP_UNAUTHENTICATED" | "MCP_FORBIDDEN", message: string) { super(message); }
}

/** Verifies an end-user Supabase access token. The service key stays server-side only. */
export class McpAuthService {
  constructor(private readonly client: SupabaseClient) {}

  async authenticate(header: string | undefined): Promise<ServerActor> {
    const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? "");
    if (!match) throw new McpAuthenticationError("MCP_UNAUTHENTICATED", "Bearer authentication is required");
    const response = await this.client.auth.getUser(match[1]);
    if (response.error || !response.data.user) throw new McpAuthenticationError("MCP_UNAUTHENTICATED", "Access token is invalid or expired");
    const metadata = claimsSchema.safeParse(response.data.user.app_metadata);
    if (!metadata.success) throw new McpAuthenticationError("MCP_FORBIDDEN", "Actor has no TerraVox environment authorization");
    return serverActorSchema.parse({ userId: response.data.user.id, allowedEnvironments: metadata.data.terravox_environments });
  }
}

export function createMcpAuthService(url: string, serviceRoleKey: string): McpAuthService {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "terravox-blender-mcp" } },
  }) as SupabaseClient;
  return new McpAuthService(client);
}

/** Process-local rate guard. Persistent distributed limiting remains an operational deployment concern. */
export class McpRateLimiter {
  private readonly buckets = new Map<string, { startedAt: number; count: number }>();
  constructor(private readonly maxPerMinute = 30) {}
  consume(actorId: string): void {
    const now = Date.now(); const previous = this.buckets.get(actorId);
    const bucket = !previous || now - previous.startedAt >= 60_000 ? { startedAt: now, count: 0 } : previous;
    bucket.count += 1; this.buckets.set(actorId, bucket);
    if (bucket.count > this.maxPerMinute) { const error = new Error("MCP_RATE_LIMITED"); error.name = "McpRateLimitError"; throw error; }
  }
}
