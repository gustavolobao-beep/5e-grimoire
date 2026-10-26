/**
 * Regras de negócio das fichas: hidratação (dados + catálogo + cálculo) e
 * operações de CRUD com validação de propriedade.
 */
import { computeCharacterSheet, checkMulticlassPrerequisites } from '../../../../shared/rules/index.js';
import { HttpError } from '../../lib/httpError.js';
import * as catalog from '../catalog/catalog.repository.js';
import * as repo from './characters.repository.js';

/** Carrega várias fichas de uma vez, resolvendo catálogo e regras (sem N+1). */
export function hydrateCharacters(rows = []) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const classes = repo.listClassesFor(ids);
  const inventory = repo.listInventoryFor(ids);
  const spells = repo.listSpellsFor(ids);

  // --- Catálogo: itens -----------------------------------------------------
  const itemIndexes = [...new Set(inventory.map((item) => item.itemIndex).filter(Boolean))];
  const equipment = catalog.findEquipmentMany(itemIndexes);
  const magicItems = catalog.findMagicItemsMany(itemIndexes);
  const itemsByIndex = new Map(
    [...equipment, ...magicItems].map((item) => [item.index, item.data]),
  );
  const magicIndexes = new Set(magicItems.map((item) => item.index));

  // --- Catálogo: magias ----------------------------------------------------
  const spellIndexes = [...new Set(spells.map((spell) => spell.spellIndex))];
  const spellsByIndex = new Map(
    catalog.findSpells(spellIndexes).map((spell) => [spell.index, spell.data]),
  );

  // --- Catálogo: classes ---------------------------------------------------
  const classIndexes = [...new Set(classes.map((entry) => entry.classIndex))];
  const classData = {};
  for (const classIndex of classIndexes) {
    const found = catalog.findClass(classIndex);
    if (found) classData[classIndex] = found.data;
  }
  const classSlotTables = catalog.classSlotTables(classIndexes);

  const weaponProficiencyIndexes = [
    ...new Set(
      Object.values(classData).flatMap((klass) =>
        (klass?.proficiencies ?? []).map((proficiency) => proficiency.index),
      ),
    ),
  ];

  return rows.map((character) => {
    const characterClasses = classes
      .filter((entry) => entry.characterId === character.id)
      .map((entry) => ({
        ...entry,
        hitDie: entry.hitDie || classData[entry.classIndex]?.hit_die || 8,
        className: classData[entry.classIndex]?.name ?? entry.classIndex,
      }));

    const characterInventory = inventory
      .filter((item) => item.characterId === character.id)
      .map((item) => {
        const resolved = item.itemIndex ? itemsByIndex.get(item.itemIndex) : null;
        const fallback = Object.keys(item.customData ?? {}).length > 0 ? item.customData : null;
        return {
          ...item,
          catalog: resolved ?? fallback ?? {},
          fromMagicCatalog: Boolean(item.itemIndex && magicIndexes.has(item.itemIndex)),
          name: item.customName ?? resolved?.name ?? fallback?.name ?? item.itemIndex ?? 'Item',
        };
      });

    const characterSpells = spells
      .filter((spell) => spell.characterId === character.id)
      .map((spell) => ({
        ...spell,
        catalog: spellsByIndex.get(spell.spellIndex) ?? null,
        name: spellsByIndex.get(spell.spellIndex)?.name ?? spell.spellIndex,
      }));

    const sheet = computeCharacterSheet({
      character,
      classes: characterClasses,
      inventory: characterInventory,
      classSlotTables,
      classData,
      weaponProficiencyIndexes,
    });

    return {
      character,
      classes: characterClasses,
      inventory: characterInventory,
      spells: characterSpells,
      sheet,
      summary: buildSummary(character, sheet),
    };
  });
}

/** Cards do dashboard e do Escudo do Mestre. */
export function buildSummary(character, sheet) {
  return {
    id: character.id,
    name: character.name,
    playerName: character.playerName,
    portraitUrl: character.portraitUrl,
    level: sheet.totalLevel,
    classes: sheet.classes.map((entry) => `${entry.className} ${entry.level}`).join(' / '),
    hpCurrent: sheet.hp.current,
    hpMax: sheet.hp.max,
    hpTemp: sheet.hp.temp,
    armorClass: sheet.armorClass.total,
    passivePerception: sheet.passivePerception,
    initiative: sheet.initiative,
    speed: sheet.speed,
    profBonus: sheet.profBonus,
    conditions: character.conditions ?? [],
    isUnconscious: sheet.hp.current <= 0,
    updatedAt: character.updatedAt,
  };
}

export function getCharacterSheet(characterId) {
  const character = repo.findCharacter(characterId);
  if (!character) return null;
  return hydrateCharacters([character])[0];
}

export function listUserCharacters(userId) {
  return hydrateCharacters(repo.listCharactersByUser(userId));
}

/** Garante que a ficha pertence ao usuário (ou lança 404/403). */
export function requireCharacter(characterId, userId) {
  const character = repo.findCharacter(characterId);
  if (!character) throw HttpError.notFound('Ficha não encontrada.');
  if (character.userId !== userId) throw HttpError.forbidden('Esta ficha pertence a outro jogador.');
  return character;
}

// ---------------------------------------------------------------------------
// Criação e atualização
// ---------------------------------------------------------------------------
function resolveClasses(inputClasses = []) {
  return inputClasses.map((entry) => {
    const klass = catalog.findClass(entry.classIndex);
    if (!klass) throw HttpError.badRequest(`Classe desconhecida: ${entry.classIndex}.`);
    return {
      classIndex: entry.classIndex,
      subclassIndex: entry.subclassIndex ?? null,
      level: entry.level,
      hitDie: entry.hitDie ?? klass.data.hit_die ?? 8,
    };
  });
}

export function createCharacter(userId, payload) {
  const classes = resolveClasses(payload.classes ?? [{ classIndex: 'fighter', level: 1 }]);

  const totalLevel = classes.reduce((sum, entry) => sum + entry.level, 0);
  if (totalLevel > 20) throw HttpError.badRequest('O nível total não pode passar de 20.');

  const character = repo.insertCharacter(userId, payload);
  repo.replaceClasses(character.id, classes);

  const hydrated = getCharacterSheet(character.id);
  return {
    ...hydrated,
    warnings: totalLevel > 20 ? [] : undefined,
  };
}

export function updateCharacter(characterId, userId, patch) {
  requireCharacter(characterId, userId);
  repo.updateCharacter(characterId, patch);
  return getCharacterSheet(characterId);
}

export function patchHp(characterId, userId, payload) {
  const character = requireCharacter(characterId, userId);
  const sheet = getCharacterSheet(characterId);

  const patch = {};
  if (payload.maxOverride !== undefined) patch.hpMaxOverride = payload.maxOverride;
  if (payload.temp !== undefined) patch.hpTemp = payload.temp;

  if (payload.current !== undefined) {
    patch.hpCurrent = payload.current;
  } else if (payload.delta !== undefined) {
    patch.hpCurrent = (character.hpCurrent ?? sheet.sheet.hp.max) + payload.delta;
  }

  repo.updateCharacter(characterId, patch);
  const hydrated = getCharacterSheet(characterId);

  // Limita o HP atual entre 0 e o máximo (regras de 0 PV = inconsciente).
  if (hydrated.character.hpCurrent > hydrated.sheet.hp.max) {
    repo.updateCharacter(characterId, { hpCurrent: hydrated.sheet.hp.max });
    return getCharacterSheet(characterId);
  }
  if (hydrated.character.hpCurrent < 0) {
    repo.updateCharacter(characterId, { hpCurrent: 0 });
    return getCharacterSheet(characterId);
  }

  return hydrated;
}

export function deleteCharacter(characterId, userId) {
  requireCharacter(characterId, userId);
  repo.deleteCharacter(characterId);
  return { deleted: true, id: characterId };
}

// ---------------------------------------------------------------------------
// Multiclasse
// ---------------------------------------------------------------------------
export function updateClasses(characterId, userId, payload) {
  const character = requireCharacter(characterId, userId);
  const classes = resolveClasses(payload.classes);

  const totalLevel = classes.reduce((sum, entry) => sum + entry.level, 0);
  if (totalLevel > 20) throw HttpError.badRequest('O nível total não pode passar de 20.');

  // Pré-requisitos de multiclasse (regras opcionais; bloqueia sem override).
  const abilities = character.abilities ?? {};
  const nonPrimary = classes.slice(1);
  const unmet = nonPrimary.flatMap((entry) => {
    const check = checkMulticlassPrerequisites({ classIndex: entry.classIndex, abilities });
    return check.ok ? [] : check.missing.map((missing) => ({ classIndex: entry.classIndex, ...missing }));
  });

  if (unmet.length > 0 && !payload.allowPrerequisiteOverride) {
    throw HttpError.badRequest(
      'Pré-requisitos de multiclasse não atendidos. Envie allowPrerequisiteOverride=true para ignorar.',
      unmet,
    );
  }

  repo.replaceClasses(characterId, classes);
  if (payload.hitDiceUsed) repo.updateCharacter(characterId, { hitDiceUsed: payload.hitDiceUsed });

  return { ...getCharacterSheet(characterId), prerequisiteWarnings: unmet };
}

// ---------------------------------------------------------------------------
// Inventário (aqui entra a regra "equipar Cota de Malha recalcula a CA")
// ---------------------------------------------------------------------------
export function addInventoryItem(characterId, userId, payload) {
  requireCharacter(characterId, userId);

  if (payload.itemIndex) {
    const resolved = catalog.resolveCatalogItem(payload.itemIndex);
    if (!resolved) throw HttpError.badRequest(`Item não encontrado no catálogo: ${payload.itemIndex}.`);
  } else if (!payload.customName) {
    throw HttpError.badRequest('Informe "itemIndex" (catálogo) ou "customName" (item homebrew).');
  }

  // O tipo escolhido para itens personalizados é guardado junto aos dados do
  // item (a tabela não tem coluna própria) para o motor resolver o "kind".
  const customData = { ...(payload.customData ?? {}) };
  if (payload.kind) customData.kind = payload.kind;

  repo.insertInventoryItem(characterId, { ...payload, customData });
  return getCharacterSheet(characterId);
}

export function updateInventoryItem(characterId, userId, itemId, patch) {
  requireCharacter(characterId, userId);
  const item = repo.findInventoryItem(itemId);
  if (!item || item.characterId !== characterId) throw HttpError.notFound('Item do inventário não encontrado.');

  repo.updateInventoryItem(itemId, patch);
  return getCharacterSheet(characterId);
}

export function removeInventoryItem(characterId, userId, itemId) {
  requireCharacter(characterId, userId);
  const item = repo.findInventoryItem(itemId);
  if (!item || item.characterId !== characterId) throw HttpError.notFound('Item do inventário não encontrado.');

  repo.deleteInventoryItem(itemId);
  return getCharacterSheet(characterId);
}

// ---------------------------------------------------------------------------
// Magias
// ---------------------------------------------------------------------------
export function addSpell(characterId, userId, payload) {
  requireCharacter(characterId, userId);
  const spell = catalog.findSpell(payload.spellIndex);
  if (!spell) throw HttpError.badRequest(`Magia não encontrada no catálogo: ${payload.spellIndex}.`);

  const existing = repo.listSpellsFor([characterId]).find((entry) => entry.spellIndex === payload.spellIndex);
  if (existing) throw HttpError.conflict('Esta magia já está na ficha.');

  repo.insertSpell(characterId, payload);
  return getCharacterSheet(characterId);
}

export function updateSpell(characterId, userId, spellId, patch) {
  requireCharacter(characterId, userId);
  const spell = repo.findCharacterSpell(spellId);
  if (!spell || spell.characterId !== characterId) throw HttpError.notFound('Magia da ficha não encontrada.');

  repo.updateSpell(spellId, patch);
  return getCharacterSheet(characterId);
}

export function removeSpell(characterId, userId, spellId) {
  requireCharacter(characterId, userId);
  const spell = repo.findCharacterSpell(spellId);
  if (!spell || spell.characterId !== characterId) throw HttpError.notFound('Magia da ficha não encontrada.');

  repo.deleteSpell(spellId);
  return getCharacterSheet(characterId);
}

// ---------------------------------------------------------------------------
// Descansos (atalho para o jogador ajustar slots, dados de vida e HP)
// ---------------------------------------------------------------------------
export function rest(characterId, userId, { type = 'long' } = {}) {
  requireCharacter(characterId, userId);
  const sheet = getCharacterSheet(characterId);

  if (type === 'long') {
    repo.updateCharacter(characterId, {
      hpCurrent: sheet.sheet.hp.max,
      hpTemp: 0,
      spellSlotsUsed: {},
      pactSlotsUsed: 0,
      hitDiceUsed: Object.fromEntries(sheet.sheet.hitDice.map((die) => [die.classIndex, Math.max(0, die.used - Math.ceil(die.total / 2))])),
    });
    const remaining = repo.listSpellsFor([characterId]);
    for (const spell of remaining) {
      if (spell.usesMax) repo.updateSpell(spell.id, { usesUsed: 0 });
    }
  } else {
    repo.updateCharacter(characterId, { pactSlotsUsed: 0 });
  }

  return getCharacterSheet(characterId);
}
