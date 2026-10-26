/**
 * Seed do catálogo 5e.
 *
 * Lê os JSONs do pacote `5e-database` (por padrão em
 * ../5e-database-main/src/2014/en) e popula as tabelas `catalog_*`.
 * Onde existe tradução pt-BR no pacote, os nomes/descrições são sobrescritos.
 *
 * Uso:  npm run seed --prefix server
 */
import fs from 'node:fs';
import path from 'node:path';
import { env, paths } from '../../config/env.js';
import { initDatabase, transaction, run, get, exec } from '../connection.js';
import { COLLECTIONS, REFERENCE_COLLECTIONS } from './collections.js';

const json = (value) => JSON.stringify(value ?? null);

/** Cita identificadores (algumas colunas, como "index", são palavras reservadas). */
const q = (identifier) => `"${identifier}"`;
const qColumns = (columns) => columns.map(q).join(', ');

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Carrega a coleção em inglês e aplica o overlay de tradução pt-BR, se houver. */
function loadCollection(file) {
  const enPath = path.join(env.srdPath, 'en', file);
  const rows = readJson(enPath);
  if (!Array.isArray(rows)) return null;

  const ptPath = path.join(env.srdPath, 'pt-BR', file);
  const translated = readJson(ptPath);
  if (!Array.isArray(translated)) return rows;

  const byIndex = new Map(translated.map((row) => [row.index, row]));
  return rows.map((row) => {
    const translation = byIndex.get(row.index);
    if (!translation) return row;
    return {
      ...row,
      ...(translation.name ? { name: translation.name } : {}),
      ...(translation.desc ? { desc: translation.desc } : {}),
    };
  });
}

function resetTable(db, table) {
  db.exec(`DELETE FROM ${table};`);
}

function seedCollection(db, collection) {
  const rows = loadCollection(collection.file);
  if (!rows) {
    console.warn(`  ! ${collection.file} não encontrado — coleção ignorada.`);
    return 0;
  }

  const placeholders = collection.columns.map(() => '?').join(', ');
  const statement = db.prepare(
    `INSERT OR REPLACE INTO ${collection.table} (${qColumns(collection.columns)}) VALUES (${placeholders})`,
  );

  resetTable(db, collection.table);
  let inserted = 0;
  for (const row of rows) {
    const values = collection.map(row, json);
    if (!values || values[0] === undefined) continue;
    statement.run(...values);
    inserted += 1;
  }

  for (const relation of collection.relations ?? []) {
    resetTable(db, relation.table);
    const relationStatement = db.prepare(
      `INSERT OR IGNORE INTO ${relation.table} (${qColumns(relation.columns)}) VALUES (${relation.columns.map(() => '?').join(', ')})`,
    );
    for (const row of rows) {
      for (const values of relation.map(row, json) ?? []) {
        if (values?.[0] && values?.[1]) relationStatement.run(...values);
      }
    }
  }

  return inserted;
}

function seedReferenceCollections(db) {
  resetTable(db, 'catalog_reference');
  const statement = db.prepare(
    `INSERT OR REPLACE INTO catalog_reference (collection, ${q('index')}, name, payload) VALUES (?, ?, ?, ?)`,
  );

  const counts = {};
  for (const collection of REFERENCE_COLLECTIONS) {
    const rows = loadCollection(collection.file);
    if (!rows) continue;
    let inserted = 0;
    for (const row of rows) {
      if (!row.index) continue;
      statement.run(collection.id, row.index, row.name ?? row.index, JSON.stringify(row));
      inserted += 1;
    }
    counts[collection.id] = inserted;
  }
  return counts;
}

function writeMeta(db) {
  let version = 'desconhecida';
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(paths.repoRoot, '5e-database-main', 'package.json'), 'utf8'),
    );
    version = pkg.version;
  } catch {
    // Pacote de dados pode estar em outro lugar — segue sem versão.
  }

  const meta = {
    'srd.version': version,
    'srd.path': env.srdPath,
    'srd.seeded_at': new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(meta)) {
    run(`INSERT OR REPLACE INTO catalog_meta (${q('key')}, value) VALUES (?, ?)`, [key, String(value)]);
  }
}

export function seedCatalog({ quiet = false } = {}) {
  const db = initDatabase();
  const log = quiet ? () => {} : (...args) => console.log(...args);

  log(`\nGrimório 5e — importando catálogo 5e`);
  log(`  origem: ${env.srdPath}`);
  log(`  destino: ${env.databasePath}\n`);

  const counts = transaction((database) => {
    const result = {};
    for (const collection of COLLECTIONS) {
      result[collection.id] = seedCollection(database, collection);
      log(`  ${String(result[collection.id]).padStart(5)}  ${collection.id}`);
    }
    const referenceCounts = seedReferenceCollections(database);
    for (const [id, count] of Object.entries(referenceCounts)) {
      log(`  ${String(count).padStart(5)}  ref:${id}`);
    }
    result.reference = Object.values(referenceCounts).reduce((sum, value) => sum + value, 0);
    writeMeta(database);
    return result;
  });

  // Checagem de integridade do catálogo mínimo esperado pelo motor de regras.
  const totalSpells = get('SELECT COUNT(*) AS total FROM catalog_spells')?.total ?? 0;
  const totalEquipment = get('SELECT COUNT(*) AS total FROM catalog_equipment')?.total ?? 0;
  const totalClasses = get('SELECT COUNT(*) AS total FROM catalog_classes')?.total ?? 0;

  log(`\n  Catálogo pronto: ${totalClasses} classes, ${totalSpells} magias, ${totalEquipment} equipamentos.`);
  log(`  Total de linhas importadas: ${Object.values(counts).reduce((sum, value) => sum + value, 0)}\n`);

  return { counts, totalSpells, totalEquipment, totalClasses };
}

/** Permite resetar o banco do zero (usado em desenvolvimento). */
export function resetDatabase() {
  const db = initDatabase();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all();
  exec('PRAGMA foreign_keys = OFF;');
  for (const { name } of tables) db.exec(`DROP TABLE IF EXISTS ${name};`);
  exec('PRAGMA foreign_keys = ON;');
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));

if (isDirectRun) {
  try {
    seedCatalog();
  } catch (error) {
    console.error('\nFalha ao importar o catálogo 5e:', error.message);
    process.exitCode = 1;
  }
}
