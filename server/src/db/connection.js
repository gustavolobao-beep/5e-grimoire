/**
 * Conexão SQLite usando o módulo nativo `node:sqlite` (Node >= 22.5),
 * o que dispensa dependências nativas compiladas.
 *
 * Observação importante: o driver não aceita booleanos nem `undefined`
 * como parâmetro — os helpers abaixo normalizam esses valores.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env.js';

let db = null;

function normalizeParams(params = []) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value !== null && typeof value === 'object' && !(value instanceof Uint8Array)) {
      return JSON.stringify(value);
    }
    if (typeof value === 'bigint') return Number(value);
    return value;
  });
}

export function getDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });
  db = new DatabaseSync(env.databasePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

/** Aplica o schema (idempotente — usa CREATE TABLE IF NOT EXISTS). */
export function applySchema() {
  const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  getDb().exec(schema);
}

export function initDatabase() {
  const database = getDb();
  applySchema();
  return database;
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...normalizeParams(params));
}

export function get(sql, params = []) {
  return getDb().prepare(sql).get(...normalizeParams(params)) ?? null;
}

export function all(sql, params = []) {
  return getDb().prepare(sql).all(...normalizeParams(params));
}

export function exec(sql) {
  return getDb().exec(sql);
}

/** Executa `fn` dentro de uma transação, revertendo em caso de erro. */
export function transaction(fn) {
  const database = getDb();
  database.exec('BEGIN');
  try {
    const result = fn(database);
    database.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // Ignora falha de rollback (transação já encerrada).
    }
    throw error;
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
