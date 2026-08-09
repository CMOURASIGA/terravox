import type { Express } from 'express';
import { buildApp } from '../app.js';

/**
 * Single Vercel Serverless Function that every /api/* request is rewritten
 * to (see vercel.json) — there was previously no api/ directory at all, so
 * none of server.ts's Express routes (/api/generate-questions,
 * /api/admin/questions, etc.) were ever reachable in production: Vercel's
 * zero-config static/function split only serves files it finds under
 * dist/ (the Vite build) or api/, and server.ts's Express app is not
 * either of those on its own — it only ran locally via `tsx server.ts` /
 * `node dist/server.cjs`.
 *
 * An Express app instance is itself a valid (req, res) handler, so it can
 * be exported and invoked directly here without ever calling .listen() —
 * same pattern as Vercel's own official Express example. The app is built
 * once per warm function instance and reused across invocations.
 */
let appPromise: Promise<Express> | null = null;

export default async function handler(req: any, res: any) {
  if (!appPromise) appPromise = buildApp();
  const app = await appPromise;
  return app(req, res);
}
