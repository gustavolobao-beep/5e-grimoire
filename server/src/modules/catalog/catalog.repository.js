/**
 * Acesso ao catálogo 5e (tabelas `catalog_*`).
 * Esta é a única camada que conhece o formato das tabelas de itens, magias,
 * classes e monstros — trocar o banco de dados 5e significa reescrever só aqui.
 */
import { all, get } from '../../db/connection.js';
import { parseJson } from '../../lib/json.js';

const hydrate = (row, column = 'payload') => (row ? { ...row, data: parseJson(row[column], {}) } : null);

// ---------------------------------------------------------------------------
// Classes, subclasses, níveis e características
// ---------------------------------------------------------------------------
export function listClasses() {
  return all('SELECT "index", name, hit_die FROM catalog_classes ORDER BY name').map((row) => ({
    ...row,
    _id: row.index,
  }));
}

export function findClass(classIndex) {
  return hydrate(get('SELECT * FROM catalog_classes WHERE "index" = ?', [classIndex]));
}

export function listSubclasses(classIndex) {
  const rows = classIndex
    ? all('SELECT * FROM catalog_subclasses WHERE class_index = ? ORDER BY name', [classIndex])
    : all('SELECT * FROM catalog_subclasses ORDER BY name');
  return rows.map((row) => hydrate(row));
}

export function findSubclass(subclassIndex) {
  return hydrate(get('SELECT * FROM catalog_subclasses WHERE "index" = ?', [subclassIndex]));
}

export function listClassLevels(classIndex) {
  return all(
    'SELECT level, prof_bonus, spell_slots, payload FROM catalog_levels WHERE class_index = ? ORDER BY level',
    [classIndex],
  ).map((row) => ({
    level: row.level,
    profBonus: row.prof_bonus,
    spellSlots: parseJson(row.spell_slots, {}),
    data: parseJson(row.payload, {}),
  }));
}

/**
 * Tabelas de slots por classe/level no formato esperado pelo motor de regras:
 * { [classIndex]: { [level]: { 1: n, 2: n } } }
 * Necessário para personagens de classe única (ex.: Paladino 5 = 4/2 slots).
 */
export function classSlotTables(classIndexes = []) {
  if (classIndexes.length === 0) return {};
  const placeholders = classIndexes.map(() => '?').join(', ');
  const rows = all(
    `SELECT class_index, level, spell_slots FROM catalog_levels WHERE class_index IN (${placeholders})`,
    classIndexes,
  );

  const tables = {};
  for (const row of rows) {
    tables[row.class_index] ??= {};
    tables[row.class_index][row.level] = parseJson(row.spell_slots, {});
  }
  return tables;
}

export function listClassFeatures(classIndex, { level } = {}) {
  const params = [classIndex];
  let sql = 'SELECT * FROM catalog_features WHERE class_index = ?';
  if (level) {
    sql += ' AND level <= ?';
    params.push(level);
  }
  sql += ' ORDER BY level, name';
  return all(sql, params).map((row) => hydrate(row));
}

// ---------------------------------------------------------------------------
// Magias
// ---------------------------------------------------------------------------
export function listSpells({ search, level, classIndex, school, ritual, concentration, limit = 60, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(s.name LIKE ? OR s."index" LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (level !== undefined && level !== null && level !== '') {
    conditions.push('s.level = ?');
    params.push(Number(level));
  }
  if (school) {
    conditions.push('s.school = ?');
    params.push(school);
  }
  if (ritual !== undefined) {
    conditions.push('s.ritual = ?');
    params.push(ritual ? 1 : 0);
  }
  if (concentration !== undefined) {
    conditions.push('s.concentration = ?');
    params.push(concentration ? 1 : 0);
  }
  if (classIndex) {
    conditions.push('sc.class_index = ?');
    params.push(classIndex);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const join = classIndex ? 'JOIN catalog_spell_classes sc ON sc.spell_index = s."index"' : '';

  const rows = all(
    `SELECT DISTINCT s.* FROM catalog_spells s ${join} ${where} ORDER BY s.level, s.name LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const total = get(
    `SELECT COUNT(DISTINCT s."index") AS total FROM catalog_spells s ${join} ${where}`,
    params,
  )?.total ?? 0;

  return { items: rows.map((row) => hydrate(row)), total };
}

export function findSpell(spellIndex) {
  return hydrate(get('SELECT * FROM catalog_spells WHERE "index" = ?', [spellIndex]));
}

export function findSpells(spellIndexes = []) {
  if (spellIndexes.length === 0) return [];
  const placeholders = spellIndexes.map(() => '?').join(', ');
  return all(`SELECT * FROM catalog_spells WHERE "index" IN (${placeholders})`, spellIndexes)
    .map((row) => hydrate(row));
}

export function listSpellClasses() {
  return all('SELECT spell_index, class_index FROM catalog_spell_classes');
}

// ---------------------------------------------------------------------------
// Equipamentos e itens mágicos
// ---------------------------------------------------------------------------
export function listEquipment({ search, kind, category, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(name LIKE ? OR "index" LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (kind) {
    conditions.push('kind = ?');
    params.push(kind);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = all(
    `SELECT * FROM catalog_equipment ${where} ORDER BY name LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const total = get(`SELECT COUNT(*) AS total FROM catalog_equipment ${where}`, params)?.total ?? 0;
  return { items: rows.map((row) => hydrate(row)), total };
}

export function findEquipment(equipmentIndex) {
  return hydrate(get('SELECT * FROM catalog_equipment WHERE "index" = ?', [equipmentIndex]));
}

/** Busca vários itens de uma vez (usado ao montar o inventário de uma ficha). */
export function findEquipmentMany(indexes = []) {
  if (indexes.length === 0) return [];
  const placeholders = indexes.map(() => '?').join(', ');
  return all(`SELECT * FROM catalog_equipment WHERE "index" IN (${placeholders})`, indexes)
    .map((row) => hydrate(row));
}

export function listMagicItems({ search, rarity, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  if (search) {
    conditions.push('(name LIKE ? OR "index" LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (rarity) {
    conditions.push('rarity = ?');
    params.push(rarity);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = all(
    `SELECT * FROM catalog_magic_items ${where} ORDER BY name LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const total = get(`SELECT COUNT(*) AS total FROM catalog_magic_items ${where}`, params)?.total ?? 0;
  return { items: rows.map((row) => hydrate(row)), total };
}

export function findMagicItem(itemIndex) {
  return hydrate(get('SELECT * FROM catalog_magic_items WHERE "index" = ?', [itemIndex]));
}

export function findMagicItemsMany(indexes = []) {
  if (indexes.length === 0) return [];
  const placeholders = indexes.map(() => '?').join(', ');
  return all(`SELECT * FROM catalog_magic_items WHERE "index" IN (${placeholders})`, indexes)
    .map((row) => hydrate(row));
}

/** Resolve um item de inventário no catálogo (equipamento ou item mágico). */
export function resolveCatalogItem(itemIndex) {
  const equipment = findEquipment(itemIndex);
  if (equipment) return { source: 'equipment', item: equipment };
  const magic = findMagicItem(itemIndex);
  if (magic) return { source: 'magic-item', item: magic };
  return null;
}

// ---------------------------------------------------------------------------
// Monstros (bestiário do SRD)
// ---------------------------------------------------------------------------
export function listMonsters({ search, type, size, crMax, crMin, limit = 60, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(name LIKE ? OR "index" LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (size) {
    conditions.push('size = ?');
    params.push(size);
  }
  if (crMin !== undefined && crMin !== '') {
    conditions.push('cr >= ?');
    params.push(Number(crMin));
  }
  if (crMax !== undefined && crMax !== '') {
    conditions.push('cr <= ?');
    params.push(Number(crMax));
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = all(
    `SELECT * FROM catalog_monsters ${where} ORDER BY cr, name LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const total = get(`SELECT COUNT(*) AS total FROM catalog_monsters ${where}`, params)?.total ?? 0;
  return { items: rows.map((row) => hydrate(row)), total };
}

export function findMonster(monsterIndex) {
  return hydrate(get('SELECT * FROM catalog_monsters WHERE "index" = ?', [monsterIndex]));
}

export function monsterTypes() {
  return all('SELECT DISTINCT type FROM catalog_monsters WHERE type IS NOT NULL ORDER BY type')
    .map((row) => row.type);
}

// ---------------------------------------------------------------------------
// Raças, antecedentes, perícias, proficiências e coleções de referência
// ---------------------------------------------------------------------------
const SIMPLE_TABLES = {
  races: 'catalog_races',
  backgrounds: 'catalog_backgrounds',
  skills: 'catalog_skills',
  proficiencies: 'catalog_proficiencies',
};

export function listSimple(collection) {
  const table = SIMPLE_TABLES[collection];
  if (!table) return null;
  return all(`SELECT * FROM ${table} ORDER BY name`).map((row) => hydrate(row));
}

export function findSimple(collection, index) {
  const table = SIMPLE_TABLES[collection];
  if (!table) return null;
  return hydrate(get(`SELECT * FROM ${table} WHERE "index" = ?`, [index]));
}

export function listReference(collection) {
  return all(
    'SELECT "index", name, payload FROM catalog_reference WHERE collection = ? ORDER BY name',
    [collection],
  ).map((row) => hydrate(row));
}

export function catalogMeta() {
  const rows = all('SELECT key, value FROM catalog_meta');
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
