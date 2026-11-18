import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createApiApp } from './src/server/createApp.ts';

async function startServer() {
  const app = createApiApp();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`ClearAir Daily server listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start ClearAir Daily server:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
