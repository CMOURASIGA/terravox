import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { buildApp } from './app';

async function startServer() {
  const app = await buildApp();
  const PORT = 3000;

  // Bundled offline previews contain compiled assets, not Vite source files.
  // Detect the bundled entry point so npm start works on Windows without NODE_ENV.
  const isProduction = process.env.NODE_ENV === 'production' || path.basename(__filename) === 'server.cjs';
  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 4 does not interpret '*all' as a catch-all route.
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
}

startServer();
