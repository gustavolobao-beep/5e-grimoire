/**
 * Progressão de conjuração e regras de multiclasse de D&D 5e.
 *
 * Regras-chave implementadas:
 * - Bônus de proficiência depende do nível TOTAL do personagem.
 * - Dados de vida são por classe (cada classe tem seu próprio dado).
 * - Slots de magia: personagem com uma única classe conjuradora usa a tabela
 *   da própria classe; com duas ou mais, usa a tabela de Multiclasse.
 * - Bruxo usa Magia de Pacto (slots separados, recarregados em descanso curto).
 */

import { clampLevel } from './proficiency.js';

/** Como cada classe contribui para o nível de conjurador multiclasse. */
export const CASTER_PROGRESSION = {
  bard: 'full',
  cleric: 'full',
  druid: 'full',
  sorcerer: 'full',
  wizard: 'full',
  paladin: 'half',
  ranger: 'half',
  artificer: 'half-roundup',
  fighter: 'third',
  rogue: 'third',
  warlock: 'pact',
};

/** Classes que usam dado de vida próprio (fallback quando o catálogo não responde). */
export const HIT_DICE_BY_CLASS = {
  barbarian: 12,
  fighter: 10,
  paladin: 10,
  ranger: 10,
  bard: 8,
  cleric: 8,
  druid: 8,
  monk: 8,
  rogue: 8,
  warlock: 8,
  artificer: 8,
  sorcerer: 6,
  wizard: 6,
};

/** Atributo de conjuração por classe. */
export const SPELLCASTING_ABILITY = {
  bard: 'cha',
  cleric: 'wis',
  druid: 'wis',
  paladin: 'cha',
  ranger: 'wis',
  sorcerer: 'cha',
  warlock: 'cha',
  wizard: 'int',
  artificer: 'int',
};

/** Pré-requisitos de atributo para entrar em uma classe via multiclasse. */
export const MULTICLASS_PREREQUISITES = {
  barbarian: { str: 13 },
  bard: { cha: 13 },
  cleric: { wis: 13 },
  druid: { wis: 13 },
  fighter: { str: 13 },
  monk: { dex: 13, wis: 13 },
  paladin: { str: 13, cha: 13 },
  ranger: { dex: 13, wis: 13 },
  rogue: { dex: 13 },
  sorcerer: { cha: 13 },
  warlock: { cha: 13 },
  wizard: { int: 13 },
};

/** Slots do conjurador multiclasse: índice 0 = nível de conjurador 1. */
export const MULTICLASS_SPELL_SLOTS = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Magia de Pacto do Bruxo: [quantidade de slots, nível dos slots]. */
export const PACT_MAGIC = [
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 6], [3, 6], [3, 7], [3, 7], [4, 7], [4, 8], [4, 8], [4, 9],
];

/** Converte uma lista de slots [2,3] em { 1: 2, 2: 3 }. */
export function slotsArrayToObject(slots = []) {
  const result = {};
  slots.forEach((value, index) => {
    if (value > 0) result[index + 1] = value;
  });
  return result;
}

/** Nível efetivo de conjurador multiclasse de uma classe. */
export function casterLevelContribution(classIndex, level) {
  const progression = CASTER_PROGRESSION[classIndex] ?? 'none';
  const safeLevel = Number(level) || 0;
  switch (progression) {
    case 'full':
      return safeLevel;
    case 'half':
      return Math.floor(safeLevel / 2);
    case 'half-roundup':
      return Math.ceil(safeLevel / 2);
    case 'third':
      return Math.floor(safeLevel / 3);
    default:
      return 0;
  }
}

/**
 * Calcula os slots de magia de um personagem (possivelmente multiclasse).
 *
 * @param {object} params
 * @param {Array<{classIndex:string, level:number}>} params.classes classes do personagem
 * @param {object} [params.classSlotTables] tabelas próprias de cada classe, no formato
 *        { [classIndex]: { [level]: { 1: n, 2: n, ... } } } (vindas do catálogo 5e).
 * @param {string} [params.casterProgressionOverride] ex.: 'third' quando a subclasse
 *        (Cavaleiro Arcano / Ladino Arcano) concede conjuração em Fighter/Rogue.
 */
export function computeSpellcastingSlots({ classes = [], classSlotTables = {}, casterProgressionOverride = {} }) {
  const valid = classes
    .map((entry) => ({
      classIndex: entry.classIndex,
      level: clampLevel(entry.level),
      progression: casterProgressionOverride[entry.classIndex] ?? CASTER_PROGRESSION[entry.classIndex] ?? 'none',
    }))
    .filter((entry) => entry.level > 0);

  const casters = valid.filter((entry) => entry.progression !== 'none');
  const warlock = valid.find((entry) => entry.progression === 'pact');
  const regularCasters = casters.filter((entry) => entry.progression !== 'pact');

  const pact = warlock ? PACT_MAGIC[clampLevel(warlock.level) - 1] : null;

  // Caso 1: uma única classe conjuradora não bruxa -> usa a tabela da própria classe.
  if (regularCasters.length === 1) {
    const only = regularCasters[0];
    const table = classSlotTables[only.classIndex]?.[only.level];
    const slots = table ?? slotsArrayToObject(MULTICLASS_SPELL_SLOTS[Math.max(0, casterLevelContribution(only.classIndex, only.level)) - 1] ?? []);
    return {
      mode: 'single',
      slots,
      pact: pact ? { count: pact[0], level: pact[1] } : null,
      casterLevel: casterLevelContribution(only.classIndex, only.level),
    };
  }

  // Caso 2: multiclasse -> soma dos níveis de conjurador.
  const casterLevel = regularCasters.reduce(
    (sum, entry) => sum + casterLevelContribution(entry.classIndex, entry.level),
    0,
  );

  const slots = casterLevel > 0
    ? slotsArrayToObject(MULTICLASS_SPELL_SLOTS[Math.min(casterLevel, 20) - 1] ?? [])
    : {};

  return {
    mode: casters.length > 1 ? 'multiclass' : 'pact-only',
    slots,
    pact: pact ? { count: pact[0], level: pact[1] } : null,
    casterLevel,
  };
}

/** Valida pré-requisitos de atributo para multiclasse. */
export function checkMulticlassPrerequisites({ classIndex, abilities = {}, isFirstClass = false }) {
  if (isFirstClass) return { ok: true, missing: [] };
  const required = MULTICLASS_PREREQUISITES[classIndex];
  if (!required) return { ok: true, missing: [] };

  const missing = Object.entries(required)
    .filter(([ability, minimum]) => (Number(abilities?.[ability]) || 0) < minimum)
    .map(([ability, minimum]) => ({ ability, minimum }));

  return { ok: missing.length === 0, missing };
}
