/** Acesso a dados das fichas (personagens, classes, inventário e magias). */
import { all, get, run } from '../../db/connection.js';
import { parseJson, toJson } from '../../lib/json.js';

// ---------------------------------------------------------------------------
// Mapeamento linha -> objeto de domínio
// ---------------------------------------------------------------------------
export function mapCharacter(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    playerName: row.player_name,
    raceIndex: row.race_index,
    subraceIndex: row.subrace_index,
    backgroundIndex: row.background_index,
    alignmentIndex: row.alignment_index,
    xp: row.xp,
    abilities: parseJson(row.abilities, {}),
    saveProficiencies: parseJson(row.save_proficiencies, []),
    skillProficiencies: parseJson(row.skill_proficiencies, []),
    skillExpertise: parseJson(row.skill_expertise, []),
    jackOfAllTrades: Boolean(row.jack_of_all_trades),
    armorClassBonus: row.armor_class_bonus,
    speed: row.speed,
    hpCurrent: row.hp_current,
    hpTemp: row.hp_temp,
    hpMaxOverride: row.hp_max_override,
    hpMode: row.hp_mode,
    hpRolls: parseJson(row.hp_rolls, {}),
    hpBonusPerLevel: row.hp_bonus_per_level,
    hitDiceUsed: parseJson(row.hit_dice_used, {}),
    spellSlotsUsed: parseJson(row.spell_slots_used, {}),
    pactSlotsUsed: row.pact_slots_used,
    inspiration: row.inspiration,
    conditions: parseJson(row.conditions, []),
    portraitUrl: row.portrait_url,
    appearance: row.appearance,
    personality: row.personality,
    ideals: row.ideals,
    bonds: row.bonds,
    flaws: row.flaws,
    backstory: row.backstory,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapClassRow(row) {
  return {
    id: row.id,
    classIndex: row.class_index,
    subclassIndex: row.subclass_index,
    level: row.level,
    hitDie: row.hit_die,
  };
}

export function mapInventoryRow(row) {
  return {
    id: row.id,
    itemIndex: row.item_index,
    customName: row.custom_name,
    customData: parseJson(row.custom_data, {}),
    quantity: row.quantity,
    equipped: Boolean(row.equipped),
    attuned: Boolean(row.attuned),
    notes: row.notes,
  };
}

export function mapSpellRow(row) {
  return {
    id: row.id,
    spellIndex: row.spell_index,
    sourceClassIndex: row.source_class_index,
    prepared: Boolean(row.prepared),
    alwaysPrepared: Boolean(row.always_prepared),
    usesMax: row.uses_max,
    usesUsed: row.uses_used,
  };
}

// ---------------------------------------------------------------------------
// Personagens
// ---------------------------------------------------------------------------
const toSnake = {
  name: 'name',
  playerName: 'player_name',
  raceIndex: 'race_index',
  subraceIndex: 'subrace_index',
  backgroundIndex: 'background_index',
  alignmentIndex: 'alignment_index',
  xp: 'xp',
  abilities: 'abilities',
  saveProficiencies: 'save_proficiencies',
  skillProficiencies: 'skill_proficiencies',
  skillExpertise: 'skill_expertise',
  jackOfAllTrades: 'jack_of_all_trades',
  armorClassBonus: 'armor_class_bonus',
  speed: 'speed',
  hpCurrent: 'hp_current',
  hpTemp: 'hp_temp',
  hpMaxOverride: 'hp_max_override',
  hpMode: 'hp_mode',
  hpRolls: 'hp_rolls',
  hpBonusPerLevel: 'hp_bonus_per_level',
  hitDiceUsed: 'hit_dice_used',
  spellSlotsUsed: 'spell_slots_used',
  pactSlotsUsed: 'pact_slots_used',
  inspiration: 'inspiration',
  conditions: 'conditions',
  portraitUrl: 'portrait_url',
  appearance: 'appearance',
  personality: 'personality',
  ideals: 'ideals',
  bonds: 'bonds',
  flaws: 'flaws',
  backstory: 'backstory',
  notes: 'notes',
};

const JSON_FIELDS = new Set([
  'abilities', 'saveProficiencies', 'skillProficiencies', 'skillExpertise',
  'hpRolls', 'hitDiceUsed', 'spellSlotsUsed', 'conditions',
]);

export function listCharactersByUser(userId) {
  return all('SELECT * FROM characters WHERE user_id = ? ORDER BY updated_at DESC', [userId])
    .map(mapCharacter);
}

export function findCharacter(id) {
  return mapCharacter(get('SELECT * FROM characters WHERE id = ?', [id]));
}

export function charactersByIds(ids = []) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  return all(`SELECT * FROM characters WHERE id IN (${placeholders})`, ids).map(mapCharacter);
}

export function insertCharacter(userId, data) {
  const columns = ['user_id', 'name'];
  const values = [userId, data.name];

  for (const [key, column] of Object.entries(toSnake)) {
    if (key === 'name' || data[key] === undefined) continue;
    let value = data[key];
    if (JSON_FIELDS.has(key)) value = toJson(value);
    else if (typeof value === 'boolean') value = value ? 1 : 0;
    columns.push(column);
    values.push(value);
  }

  const placeholders = columns.map(() => '?').join(', ');
  const result = run(
    `INSERT INTO characters (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
  return findCharacter(Number(result.lastInsertRowid));
}

export function updateCharacter(id, patch = {}) {
  const assignments = [];
  const params = [];

  for (const [key, column] of Object.entries(toSnake)) {
    if (patch[key] === undefined) continue;
    let value = patch[key];
    if (JSON_FIELDS.has(key)) value = toJson(value);
    else if (typeof value === 'boolean') value = value ? 1 : 0;
    assignments.push(`${column} = ?`);
    params.push(value);
  }

  if (assignments.length === 0) return findCharacter(id);

  assignments.push("updated_at = datetime('now')");
  run(`UPDATE characters SET ${assignments.join(', ')} WHERE id = ?`, [...params, id]);
  return findCharacter(id);
}

export function deleteCharacter(id) {
  run('DELETE FROM characters WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Classes do personagem (multiclasse)
// ---------------------------------------------------------------------------
export function listClassesFor(characterIds = []) {
  if (characterIds.length === 0) return [];
  const placeholders = characterIds.map(() => '?').join(', ');
  return all(
    `SELECT * FROM character_classes WHERE character_id IN (${placeholders}) ORDER BY id`,
    characterIds,
  ).map((row) => ({ characterId: row.character_id, ...mapClassRow(row) }));
}

export function replaceClasses(characterId, classes = []) {
  run('DELETE FROM character_classes WHERE character_id = ?', [characterId]);
  for (const entry of classes) {
    run(
      `INSERT INTO character_classes (character_id, class_index, subclass_index, level, hit_die)
       VALUES (?, ?, ?, ?, ?)`,
      [characterId, entry.classIndex, entry.subclassIndex ?? null, entry.level, entry.hitDie ?? 8],
    );
  }
  return listClassesFor([characterId]);
}

export function countCharactersByClass(classIndex) {
  return get(
    `SELECT COUNT(DISTINCT character_id) AS total FROM character_classes
     WHERE class_index = ? AND level > 0`,
    [classIndex],
  )?.total ?? 0;
}

// ---------------------------------------------------------------------------
// Inventário
// ---------------------------------------------------------------------------
export function listInventoryFor(characterIds = []) {
  if (characterIds.length === 0) return [];
  const placeholders = characterIds.map(() => '?').join(', ');
  return all(
    `SELECT * FROM character_inventory WHERE character_id IN (${placeholders}) ORDER BY id`,
    characterIds,
  ).map((row) => ({ characterId: row.character_id, ...mapInventoryRow(row) }));
}

export function findInventoryItem(id) {
  const row = get('SELECT * FROM character_inventory WHERE id = ?', [id]);
  return row ? { characterId: row.character_id, ...mapInventoryRow(row) } : null;
}

export function insertInventoryItem(characterId, data) {
  const result = run(
    `INSERT INTO character_inventory
       (character_id, item_index, custom_name, custom_data, quantity, equipped, attuned, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      characterId,
      data.itemIndex ?? null,
      data.customName ?? null,
      toJson(data.customData ?? {}),
      data.quantity ?? 1,
      data.equipped ?? false,
      data.attuned ?? false,
      data.notes ?? null,
    ],
  );
  return findInventoryItem(Number(result.lastInsertRowid));
}

export function updateInventoryItem(id, patch = {}) {
  const columns = {
    itemIndex: 'item_index',
    customName: 'custom_name',
    customData: 'custom_data',
    quantity: 'quantity',
    equipped: 'equipped',
    attuned: 'attuned',
    notes: 'notes',
  };

  const assignments = [];
  const params = [];
  for (const [key, column] of Object.entries(columns)) {
    if (patch[key] === undefined) continue;
    let value = patch[key];
    if (key === 'customData') value = toJson(value);
    else if (typeof value === 'boolean') value = value ? 1 : 0;
    assignments.push(`${column} = ?`);
    params.push(value);
  }

  if (assignments.length === 0) return findInventoryItem(id);
  run(`UPDATE character_inventory SET ${assignments.join(', ')} WHERE id = ?`, [...params, id]);
  return findInventoryItem(id);
}

export function deleteInventoryItem(id) {
  run('DELETE FROM character_inventory WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Magias
// ---------------------------------------------------------------------------
export function listSpellsFor(characterIds = []) {
  if (characterIds.length === 0) return [];
  const placeholders = characterIds.map(() => '?').join(', ');
  return all(
    `SELECT * FROM character_spells WHERE character_id IN (${placeholders}) ORDER BY spell_index`,
    characterIds,
  ).map((row) => ({ characterId: row.character_id, ...mapSpellRow(row) }));
}

export function findCharacterSpell(id) {
  const row = get('SELECT * FROM character_spells WHERE id = ?', [id]);
  return row ? { characterId: row.character_id, ...mapSpellRow(row) } : null;
}

export function insertSpell(characterId, data) {
  const result = run(
    `INSERT INTO character_spells
       (character_id, spell_index, source_class_index, prepared, always_prepared, uses_max, uses_used)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      characterId,
      data.spellIndex,
      data.sourceClassIndex ?? null,
      data.prepared ?? false,
      data.alwaysPrepared ?? false,
      data.usesMax ?? null,
      data.usesUsed ?? 0,
    ],
  );
  return findCharacterSpell(Number(result.lastInsertRowid));
}

export function updateSpell(id, patch = {}) {
  const columns = {
    sourceClassIndex: 'source_class_index',
    prepared: 'prepared',
    alwaysPrepared: 'always_prepared',
    usesMax: 'uses_max',
    usesUsed: 'uses_used',
  };

  const assignments = [];
  const params = [];
  for (const [key, column] of Object.entries(columns)) {
    if (patch[key] === undefined) continue;
    const value = typeof patch[key] === 'boolean' ? (patch[key] ? 1 : 0) : patch[key];
    assignments.push(`${column} = ?`);
    params.push(value);
  }

  if (assignments.length === 0) return findCharacterSpell(id);
  run(`UPDATE character_spells SET ${assignments.join(', ')} WHERE id = ?`, [...params, id]);
  return findCharacterSpell(id);
}

export function deleteSpell(id) {
  run('DELETE FROM character_spells WHERE id = ?', [id]);
}
