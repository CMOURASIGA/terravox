import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { logger } from "../src/lib/logger.js";
import { getEnv } from "../src/config/env.js";
import { createMcpAuthService, McpAuthenticationError, McpRateLimiter } from "../src/services/mcpAuthService.js";
import { createMcpServer } from "../src/server/createMcpServer.js";

export const config = {
  api: {
    bodyParser: true,
  },
};

function setCors(res: VercelResponse): void {
  // This control plane is not a browser-public API. Do not grant cross-origin access by default.
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  );
}

const rateLimiter = new McpRateLimiter();

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }));
    return;
  }

  const startedAt = Date.now();
  let actor;
  try {
    const env = getEnv();
    // Test transport has no real auth issuer. Production always verifies a Bearer token.
    if (env.NODE_ENV !== "test") {
      actor = await createMcpAuthService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY).authenticate(req.headers.authorization);
      rateLimiter.consume(actor.userId);
    }
  } catch (error) {
    const code = error instanceof McpAuthenticationError ? error.code : error instanceof Error && error.name === "McpRateLimitError" ? "MCP_RATE_LIMITED" : "MCP_UNAUTHENTICATED";
    logger.warn("mcp.request_rejected", { code, durationMs: Date.now() - startedAt });
    res.statusCode = code === "MCP_RATE_LIMITED" ? 429 : 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: code }));
    return;
  }
  const server = createMcpServer(undefined, actor);
  const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    logger.info("mcp.request_completed", {
      method: req.method,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("mcp.request_failed", {
      method: req.method,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }));
    }
  } finally {
    await transport.close();
    await server.close();
  }
}
