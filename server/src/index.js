/** Ponto de entrada do servidor: HTTP + Socket.IO. */
import http from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { initDatabase } from './db/connection.js';
import { initRealtime } from './realtime/io.js';

const db = initDatabase();
const app = createApp();
const server = http.createServer(app);

initRealtime(server, { corsOrigins: env.clientOrigins });

// Encerramento gracioso (importante para o SQLite em WAL).
const shutdown = (signal) => () => {
  console.log(`\n[${signal}] encerrando Grimório 5e...`);
  server.close(() => {
    try {
      db.close();
    } catch {
      // Banco já fechado.
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
};

process.on('SIGINT', shutdown('SIGINT'));
process.on('SIGTERM', shutdown('SIGTERM'));

server.listen(env.port, () => {
  console.log('\n  Grimório 5e — API pronta');
  console.log(`  http://localhost:${env.port}/api/health`);
  console.log(`  CORS liberado para: ${env.clientOrigins.join(', ')}\n`);
});
