/**
 * Definição declarativa das coleções do catálogo 5e.
 *
 * Cada entrada descreve de qual arquivo JSON do pacote `5e-database` os dados
 * vêm, para qual tabela vão e como cada linha é mapeada.
 * Para plugar uma nova coleção (ou trocar por outro banco 5e), basta adicionar
 * um item aqui — nenhuma outra parte do seed precisa mudar.
 */

/** Deduz o tipo normalizado de um equipamento (arma/armadura/escudo/geral). */
export function equipmentKind(row) {
  const category = String(row.equipment_category?.index ?? '').toLowerCase();
  const armorCategory = String(row.armor_category ?? '').toLowerCase();

  if (armorCategory === 'shield' || category === 'shield') return 'shield';
  if (category === 'armor' || armorCategory) return 'armor';
  if (category === 'weapon' || row.damage?.damage_dice) return 'weapon';
  return 'gear';
}

/** Normaliza o bloco de conjuração de um nível de classe em { 1: n, 2: n }. */
export function normalizeLevelSlots(level) {
  const raw = level.spellcasting;
  if (!raw) return {};
  const slots = {};
  for (let slot = 1; slot <= 9; slot += 1) {
    const value = raw[`spell_slots_level_${slot}`];
    if (Number(value) > 0) slots[slot] = Number(value);
  }
  return slots;
}

/** Coleções com tabela dedicada (consultas frequentes pelo motor de regras). */
export const COLLECTIONS = [
  {
    id: 'classes',
    file: '5e-SRD-Classes.json',
    table: 'catalog_classes',
    columns: ['index', 'name', 'hit_die', 'payload'],
    map: (row, json) => [row.index, row.name, row.hit_die ?? null, json(row)],
  },
  {
    id: 'subclasses',
    file: '5e-SRD-Subclasses.json',
    table: 'catalog_subclasses',
    columns: ['index', 'name', 'class_index', 'payload'],
    map: (row, json) => [row.index, row.name, row.class?.index ?? null, json(row)],
  },
  {
    id: 'levels',
    file: '5e-SRD-Levels.json',
    table: 'catalog_levels',
    columns: ['class_index', 'level', 'prof_bonus', 'spell_slots', 'payload'],
    map: (row, json) => [
      row.class?.index ?? row.index.split('-').slice(0, -1).join('-'),
      row.level,
      row.prof_bonus ?? null,
      json(normalizeLevelSlots(row)),
      json(row),
    ],
  },
  {
    id: 'features',
    file: '5e-SRD-Features.json',
    table: 'catalog_features',
    columns: ['index', 'name', 'class_index', 'level', 'payload'],
    map: (row, json) => [row.index, row.name, row.class?.index ?? null, row.level ?? null, json(row)],
  },
  {
    id: 'spells',
    file: '5e-SRD-Spells.json',
    table: 'catalog_spells',
    columns: ['index', 'name', 'level', 'school', 'ritual', 'concentration', 'payload'],
    map: (row, json) => [
      row.index,
      row.name,
      row.level ?? 0,
      row.school?.index ?? null,
      row.ritual ? 1 : 0,
      row.concentration ? 1 : 0,
      json(row),
    ],
    /** Tabela de ligação magia <-> classes que podem aprendê-la. */
    relations: [
      {
        table: 'catalog_spell_classes',
        columns: ['spell_index', 'class_index'],
        map: (row) => (row.classes ?? []).map((klass) => [row.index, klass.index]),
      },
    ],
  },
  {
    id: 'equipment',
    file: '5e-SRD-Equipment.json',
    table: 'catalog_equipment',
    columns: ['index', 'name', 'category', 'kind', 'weight', 'cost', 'payload'],
    map: (row, json) => [
      row.index,
      row.name,
      row.equipment_category?.index ?? null,
      equipmentKind(row),
      row.weight ?? null,
      row.cost ? `${row.cost.quantity} ${row.cost.unit}` : null,
      json(row),
    ],
  },
  {
    id: 'magic-items',
    file: '5e-SRD-Magic-Items.json',
    table: 'catalog_magic_items',
    columns: ['index', 'name', 'rarity', 'payload'],
    map: (row, json) => [row.index, row.name, row.rarity?.name ?? null, json(row)],
  },
  {
    id: 'monsters',
    file: '5e-SRD-Monsters.json',
    table: 'catalog_monsters',
    columns: ['index', 'name', 'cr', 'type', 'size', 'xp', 'payload'],
    map: (row, json) => [
      row.index,
      row.name,
      Number(row.challenge_rating) || 0,
      row.type ?? null,
      row.size ?? null,
      row.xp ?? null,
      json(row),
    ],
  },
  {
    id: 'races',
    file: '5e-SRD-Races.json',
    table: 'catalog_races',
    columns: ['index', 'name', 'payload'],
    map: (row, json) => [row.index, row.name, json(row)],
  },
  {
    id: 'subraces',
    file: '5e-SRD-Subraces.json',
    table: 'catalog_subraces',
    columns: ['index', 'name', 'race_index', 'payload'],
    map: (row, json) => [row.index, row.name, row.race?.index ?? null, json(row)],
  },
  {
    id: 'backgrounds',
    file: '5e-SRD-Backgrounds.json',
    table: 'catalog_backgrounds',
    columns: ['index', 'name', 'payload'],
    map: (row, json) => [row.index, row.name, json(row)],
  },
  {
    id: 'skills',
    file: '5e-SRD-Skills.json',
    table: 'catalog_skills',
    columns: ['index', 'name', 'ability', 'payload'],
    map: (row, json) => [row.index, row.name, row.ability_score?.index ?? null, json(row)],
  },
  {
    id: 'proficiencies',
    file: '5e-SRD-Proficiencies.json',
    table: 'catalog_proficiencies',
    columns: ['index', 'name', 'type', 'payload'],
    map: (row, json) => [row.index, row.name, row.type ?? null, json(row)],
  },
];

/**
 * Coleções "de referência": pequenas tabelas estáticas (condições, tipos de
 * dano, escolas de magia...). Ficam em uma única tabela chave-valor por coleção.
 */
export const REFERENCE_COLLECTIONS = [
  { id: 'ability-scores', file: '5e-SRD-Ability-Scores.json' },
  { id: 'alignments', file: '5e-SRD-Alignments.json' },
  { id: 'conditions', file: '5e-SRD-Conditions.json' },
  { id: 'damage-types', file: '5e-SRD-Damage-Types.json' },
  { id: 'feats', file: '5e-SRD-Feats.json' },
  { id: 'languages', file: '5e-SRD-Languages.json' },
  { id: 'magic-schools', file: '5e-SRD-Magic-Schools.json' },
  { id: 'weapon-properties', file: '5e-SRD-Weapon-Properties.json' },
  { id: 'equipment-categories', file: '5e-SRD-Equipment-Categories.json' },
  { id: 'traits', file: '5e-SRD-Traits.json' },
  { id: 'rules', file: '5e-SRD-Rules.json' },
  { id: 'rule-sections', file: '5e-SRD-Rule-Sections.json' },
];
