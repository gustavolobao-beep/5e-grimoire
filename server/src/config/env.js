/**
 * Configuração central do servidor (variáveis de ambiente com padrões de dev).
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = path.resolve(serverRoot, '..');

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 4000,
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? 'grimorio-5e-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  databasePath: path.resolve(serverRoot, process.env.DATABASE_PATH ?? './data/grimorio.db'),
  srdPath: process.env.SRD_DB_PATH
    ? path.resolve(process.env.SRD_DB_PATH)
    : path.join(repoRoot, '5e-database-main', 'src', '2014'),
};

export const paths = { serverRoot, repoRoot };
