/** Montagem da aplicação Express. */
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { env, paths } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
      return callback(null, true); // em dev aceitamos qualquer origem local
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '2mb' }));

  app.use('/api', apiRouter);

  // Em produção, serve o build do Vite (client/dist) na mesma porta.
  const clientDist = path.join(paths.repoRoot, 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
