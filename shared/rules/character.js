/**
 * Motor de regras central: a partir dos dados crus de um personagem
 * (atributos, classes, inventário) calcula tudo o que a ficha precisa exibir.
 *
 * Esse mesmo cálculo roda no backend (para o Escudo do Mestre e para o log de
 * rolagens) e no frontend (para a ficha reagir na hora, sem round-trip).
 */

import { ABILITY_KEYS, abilityModifier, abilityModifiers, normalizeAbilities } from './abilities.js';
import { proficiencyBonus, clampLevel } from './proficiency.js';
import { SKILLS, skillBonus } from './skills.js';
import {
  armorFromCatalogItem,
  computeArmorClass,
  computeMaxHp,
  computeHitDice,
} from './combat.js';
import { computeSpellcastingSlots, SPELLCASTING_ABILITY } from './spellSlots.js';
import { weaponAttackFromItem, unarmedStrike } from './weapons.js';

const KIND_ALIASES = {
  weapon: 'weapon',
  armor: 'armor',
  shield: 'shield',
  gear: 'gear',
  magic: 'magic',
  magic_item: 'magic',
};

/** Deduz o tipo de um item de inventário a partir do catálogo 5e. */
export function resolveItemKind(item = {}) {
  if (item.kind) return KIND_ALIASES[item.kind] ?? item.kind;

  // Tipo escolhido manualmente ao criar um item personalizado.
  const customKind = item.customData?.kind;
  if (customKind) return KIND_ALIASES[customKind] ?? customKind;

  const catalog = item.catalog ?? item;
  const category = String(catalog.equipment_category?.index ?? catalog.equipment_category ?? '').toLowerCase();
  const armorCategory = String(catalog.armor_category ?? '').toLowerCase();

  if (armorCategory === 'shield' || category === 'shield') return 'shield';
  if (category === 'armor' || armorCategory) return 'armor';
  if (category === 'weapon' || catalog.damage?.damage_dice) return 'weapon';
  // Itens vindos do catálogo de itens mágicos (anéis, mantos, varinhas…) que não
  // são armas nem armaduras entram como itens mágicos (equipáveis).
  if (
    item.fromMagicCatalog
    || ['wand', 'staff', 'rod', 'potion', 'ring', 'scroll', 'wondrous'].includes(category)
  ) {
    return 'magic';
  }
  return 'gear';
}

/** Conjunto de proficiências de arma do personagem (para calcular o ataque). */
function weaponProficient(item, { weaponProficiencyIndexes = [], classIndexes = [] } = {}) {
  const catalog = item.catalog ?? item;
  const categories = [catalog.weapon_category, catalog.category_range]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (catalog.index && weaponProficiencyIndexes.includes(catalog.index)) return true;
  if (categories.length === 0) return false;

  // Ex.: "Simple Melee" -> proficiências "simple" e "simple-melee"
  const simple = categories.some((value) => value.startsWith('simple'));
  const martial = categories.some((value) => value.startsWith('martial'));
  if (simple && (weaponProficiencyIndexes.includes('simple-weapons') || weaponProficiencyIndexes.includes('simple'))) return true;
  if (martial && (weaponProficiencyIndexes.includes('martial-weapons') || weaponProficiencyIndexes.includes('martial'))) return true;

  // Fallback: assume proficiência se o personagem tem alguma classe marcial.
  const martialClasses = ['barbarian', 'fighter', 'paladin', 'ranger'];
  return classIndexes.some((index) => martialClasses.includes(index)) && martial;
}

/**
 * Normaliza os modificadores dinâmicos de um item equipado.
 * Formato aceito: `[{ type: 'armor', ac_bonus: 2 }, { type: 'magic_item', stat_boost: { str: 2 } }]`
 * (também aceita as chaves em camelCase: acBonus / statBoost).
 */
export function normalizeItemModifiers(modifiers) {
  if (!Array.isArray(modifiers)) return [];
  return modifiers
    .filter((modifier) => modifier && typeof modifier === 'object')
    .map((modifier) => ({
      type: modifier.type ?? 'other',
      label: modifier.label ?? null,
      acBonus: Number(modifier.ac_bonus ?? modifier.acBonus) || 0,
      saveBonus: Number(modifier.save_bonus ?? modifier.saveBonus) || 0,
      statBoost: Object.fromEntries(
        ABILITY_KEYS
          .map((key) => [key, Number(modifier.stat_boost?.[key] ?? modifier.statBoost?.[key]) || 0])
          .filter(([, value]) => value !== 0),
      ),
    }))
    .filter((modifier) => modifier.acBonus || modifier.saveBonus || Object.keys(modifier.statBoost).length > 0);
}

/** Soma os modificadores de todos os itens equipados. */
export function collectEquippedModifiers(inventory = []) {
  const list = (inventory ?? [])
    .filter((item) => item.equipped)
    .flatMap((item) => normalizeItemModifiers(item.customData?.modifiers ?? item.modifiers));

  const acBonus = list.reduce((sum, modifier) => sum + modifier.acBonus, 0);
  const saveBonus = list.reduce((sum, modifier) => sum + modifier.saveBonus, 0);
  const statBoost = {};
  for (const modifier of list) {
    for (const [key, value] of Object.entries(modifier.statBoost)) {
      statBoost[key] = (statBoost[key] ?? 0) + value;
    }
  }

  return { list, acBonus, saveBonus, statBoost };
}

/**
 * @param {object} params
 * @param {object} params.character dados crus do personagem
 * @param {Array} [params.classes] [{ classIndex, level, hitDie, subclassIndex }]
 * @param {Array} [params.inventory] itens com `catalog` (ou campos do SRD)
 * @param {object} [params.classSlotTables] tabelas de slot por classe vindas do catálogo
 * @param {object} [params.classData] dados de classe (nome, dado de vida, atributo de conjuração)
 * @param {object} [params.weaponProficiencyIndexes] proficiências de arma do personagem
 */
export function computeCharacterSheet({
  character = {},
  classes = [],
  inventory = [],
  classSlotTables = {},
  classData = {},
  weaponProficiencyIndexes = [],
} = {}) {
  const normalizedInventory = (inventory ?? []).map((item) => ({
    ...item,
    kind: resolveItemKind(item),
    catalog: item.catalog ?? item,
  }));

  // Itens equipados (armas, armaduras, escudos e itens mágicos) podem trazer
  // modificadores dinâmicos: bônus de CA, de resistências e de atributos.
  const itemModifiers = collectEquippedModifiers(normalizedInventory);

  const baseAbilities = normalizeAbilities(character.abilities);
  const abilities = normalizeAbilities(
    Object.fromEntries(
      ABILITY_KEYS.map((key) => [key, baseAbilities[key] + (itemModifiers.statBoost[key] ?? 0)]),
    ),
  );
  const mods = abilityModifiers(abilities);

  const normalizedClasses = (classes ?? [])
    .map((entry) => ({
      classIndex: entry.classIndex,
      className: entry.className ?? classData[entry.classIndex]?.name ?? entry.classIndex,
      subclassIndex: entry.subclassIndex ?? null,
      level: clampLevel(entry.level),
      hitDie: Number(entry.hitDie) || Number(classData[entry.classIndex]?.hit_die) || 8,
    }))
    .filter((entry) => entry.level > 0);

  const totalLevel = normalizedClasses.reduce((sum, entry) => sum + entry.level, 0) || 1;
  const profBonus = proficiencyBonus(totalLevel);
  const classIndexes = normalizedClasses.map((entry) => entry.classIndex);

  const saveProficiencies = new Set(character.saveProficiencies ?? []);
  const skillProficiencies = new Set(character.skillProficiencies ?? []);
  const skillExpertise = new Set(character.skillExpertise ?? []);
  const jackOfAllTrades = Boolean(character.jackOfAllTrades ?? classIndexes.includes('bard'));

  // ---- Atributos, testes de resistência e perícias -------------------------
  const savingThrows = ABILITY_KEYS.map((key) => {
    const proficient = saveProficiencies.has(key);
    return {
      key,
      abilityMod: mods[key],
      proficient,
      total: mods[key] + (proficient ? profBonus : 0) + itemModifiers.saveBonus,
    };
  });

  const skills = SKILLS.map((skill) => {
    const proficient = skillProficiencies.has(skill.key);
    return {
      ...skill,
      abilityMod: mods[skill.ability],
      proficient,
      expertise: skillExpertise.has(skill.key),
      total: skillBonus({
        abilityMod: mods[skill.ability],
        proficiencyBonus: profBonus,
        proficient,
        expertise: skillExpertise.has(skill.key),
        includeHalfProficiency: jackOfAllTrades,
      }),
    };
  });

  const passivePerception = 10 + (skills.find((skill) => skill.key === 'perception')?.total ?? 0);

  // ---- Combate: CA, iniciativa, HP ----------------------------------------
  const equippedArmors = normalizedInventory
    .filter((item) => item.equipped && (item.kind === 'armor' || item.kind === 'shield'))
    .map((item) => armorFromCatalogItem(item.catalog) ?? armorFromCatalogItem(item))
    .filter(Boolean);

  const unarmoredDefense = classIndexes.includes('barbarian')
    ? 'barbarian'
    : classIndexes.includes('monk')
      ? 'monk'
      : null;

  const armorClass = computeArmorClass({
    dexMod: mods.dex,
    conMod: mods.con,
    wisMod: mods.wis,
    armors: equippedArmors,
    miscBonus: (Number(character.armorClassBonus) || 0) + itemModifiers.acBonus,
    unarmoredDefense,
  });

  const hp = computeMaxHp({
    classes: normalizedClasses,
    conMod: mods.con,
    hpRolls: character.hpRolls ?? {},
    hpMode: character.hpMode ?? 'average',
    bonusPerLevel: Number(character.hpBonusPerLevel) || 0,
  });

  const maxHp = Number(character.hpMaxOverride) > 0 ? Number(character.hpMaxOverride) : hp.max;

  const hitDice = computeHitDice({
    classes: normalizedClasses,
    hitDiceUsed: character.hitDiceUsed ?? {},
  });

  // ---- Ataques ------------------------------------------------------------
  const equippedWeapons = normalizedInventory.filter((item) => item.equipped && item.kind === 'weapon');
  const attacks = equippedWeapons
    .map((item) => weaponAttackFromItem(item, {
      abilityMods: mods,
      profBonus,
      proficient: weaponProficient(item, { weaponProficiencyIndexes, classIndexes }),
    }))
    .filter(Boolean);

  if (character.includeUnarmed !== false) {
    attacks.push(unarmedStrike({ abilityMods: mods, profBonus }));
  }

  // ---- Conjuração ---------------------------------------------------------
  const spellcasting = computeSpellcastingSlots({
    classes: normalizedClasses,
    classSlotTables,
    casterProgressionOverride: character.casterProgressionOverride ?? {},
  });

  const casterClasses = normalizedClasses.filter((entry) => SPELLCASTING_ABILITY[entry.classIndex]);
  const primaryCaster = casterClasses.sort((a, b) => b.level - a.level)[0] ?? null;
  const spellAbility = primaryCaster
    ? (classData[primaryCaster.classIndex]?.spellcasting?.spellcasting_ability?.index
      ?? classData[primaryCaster.classIndex]?.spellcastingAbility
      ?? SPELLCASTING_ABILITY[primaryCaster.classIndex])
    : null;

  const spellcastingStats = spellAbility
    ? {
      ability: spellAbility,
      abilityMod: mods[spellAbility] ?? 0,
      saveDc: 8 + profBonus + (mods[spellAbility] ?? 0),
      attackBonus: profBonus + (mods[spellAbility] ?? 0),
      perClass: casterClasses.map((entry) => {
        const ability = classData[entry.classIndex]?.spellcasting?.spellcasting_ability?.index
          ?? SPELLCASTING_ABILITY[entry.classIndex];
        return {
          classIndex: entry.classIndex,
          className: entry.className,
          ability,
          saveDc: 8 + profBonus + (mods[ability] ?? 0),
          attackBonus: profBonus + (mods[ability] ?? 0),
        };
      }),
    }
    : null;

  const spellSlots = {
    ...spellcasting,
    used: character.spellSlotsUsed ?? {},
    pactUsed: Number(character.pactSlotsUsed) || 0,
  };

  // ---- Resumo ------------------------------------------------------------
  return {
    totalLevel,
    profBonus,
    abilities,
    abilityMods: mods,
    savingThrows,
    skills,
    passivePerception,
    initiative: mods.dex,
    speed: Number(character.speed) || 9,
    armorClass,
    hp: {
      max: maxHp,
      base: hp.max,
      current: Number(character.hpCurrent ?? maxHp),
      temp: Number(character.hpTemp) || 0,
      mode: hp.mode,
      perLevel: hp.perLevel,
    },
    hitDice,
    attacks,
    inventory: normalizedInventory,
    itemModifiers,
    classes: normalizedClasses,
    spellcasting: spellcastingStats,
    spellSlots,
    multiclass: normalizedClasses.length > 1,
    warnings: buildWarnings({ normalizedClasses, equippedArmors, armorClass, abilities }),
  };
}

/** Avisos úteis para o Mestre/Jogador (ex.: armadura pesada sem FOR suficiente). */
function buildWarnings({ normalizedClasses, equippedArmors, armorClass, abilities }) {
  const warnings = [];
  const strScore = abilities.str ?? 10;

  if (armorClass.strRequirement && strScore < armorClass.strRequirement) {
    warnings.push(
      `Armadura pesada exige FOR ${armorClass.strRequirement} (atual ${strScore}): deslocamento reduzido em 3 metros.`,
    );
  }
  if (armorClass.stealthDisadvantage) {
    warnings.push('A armadura equipada impõe desvantagem em testes de Furtividade.');
  }
  if (normalizedClasses.length > 1) {
    const total = normalizedClasses.reduce((sum, entry) => sum + entry.level, 0);
    if (total > 20) warnings.push('Nível total acima de 20 (limite das regras).');
  }
  if (equippedArmors.length === 0 && armorClass.source.startsWith('Sem armadura')) {
    warnings.push('Nenhuma armadura equipada: a CA usa 10 + DES.');
  }
  return warnings;
}

/** Compatibilidade: expõe o modificador para quem só precisa dele. */
export { abilityModifier };
