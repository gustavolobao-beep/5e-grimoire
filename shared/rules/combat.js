/**
 * Cálculo de Classe de Armadura (CA) e Pontos de Vida, incluindo
 * armaduras, escudos e habilidades de defesa sem armadura.
 */

import { abilityModifier } from './abilities.js';
import { clampLevel } from './proficiency.js';

/**
 * Categoria de armadura a partir do item de inventário.
 * Ordem de precedência quando há mais de uma armadura equipada.
 */
const ARMOR_PRIORITY = { heavy: 3, medium: 2, light: 1 };

/** Converte o item do catálogo 5e em um descritor de armadura usado no cálculo. */
export function armorFromCatalogItem(item) {
  if (!item) return null;
  const category = String(item.armor_category ?? '').toLowerCase();
  const armorClass = item.armor_class;

  // Escudo: o SRD traz armor_category = "Shield" (ou equipment_category shield).
  const isShield = category === 'shield'
    || item.equipment_category?.index === 'shield'
    || item.index === 'shield';

  if (isShield) {
    return { kind: 'shield', base: Number(armorClass?.base) || 2, category: 'shield' };
  }

  if (!armorClass || typeof armorClass.base !== 'number') return null;

  return {
    kind: 'armor',
    base: Number(armorClass.base) || 10,
    dexBonus: Boolean(armorClass.dex_bonus),
    maxBonus: Number.isFinite(armorClass.max_bonus) ? Number(armorClass.max_bonus) : null,
    category: category || 'light',
    strMinimum: Number(item.str_minimum) || 0,
    stealthDisadvantage: Boolean(item.stealth_disadvantage),
  };
}

/**
 * CA final do personagem.
 *
 * @param {object} params
 * @param {number} params.dexMod modificador de Destreza
 * @param {number} [params.conMod] modificador de Constituição (Defesa sem Armadura do Bárbaro)
 * @param {number} [params.wisMod] modificador de Sabedoria (Defesa sem Armadura do Monge)
 * @param {Array} [params.armors] armaduras equipadas (formato de armorFromCatalogItem)
 * @param {boolean} [params.hasShield] escudo equipado
 * @param {number} [params.miscBonus] bônus diversos (itens mágicos, estilo de luta, etc.)
 * @param {string} [params.unarmoredDefense] 'barbarian' | 'monk' | null
 */
export function computeArmorClass({
  dexMod = 0,
  conMod = 0,
  wisMod = 0,
  armors = [],
  hasShield = false,
  miscBonus = 0,
  unarmoredDefense = null,
} = {}) {
  const worn = (armors ?? []).filter(Boolean).filter((armor) => armor.kind === 'armor');
  const shieldFromList = (armors ?? []).some((armor) => armor?.kind === 'shield');
  const shieldEquipped = hasShield || shieldFromList;

  let base = 10 + dexMod;
  let source = 'Sem armadura';
  let stealthDisadvantage = false;
  let strRequirement = 0;

  if (worn.length > 0) {
    // Se houver várias, prevalece a de maior prioridade (pesada > média > leve).
    const armor = [...worn].sort(
      (a, b) => (ARMOR_PRIORITY[b.category] ?? 0) - (ARMOR_PRIORITY[a.category] ?? 0),
    )[0];

    let dexPart = 0;
    if (armor.dexBonus) {
      dexPart = armor.maxBonus === null ? dexMod : Math.min(dexMod, armor.maxBonus);
    }

    base = armor.base + dexPart;
    source = `${armor.category} (base ${armor.base})`;
    stealthDisadvantage = armor.stealthDisadvantage;
    strRequirement = armor.strMinimum ?? 0;
  } else if (unarmoredDefense === 'barbarian') {
    base = 10 + dexMod + conMod;
    source = 'Defesa sem Armadura (Bárbaro)';
  } else if (unarmoredDefense === 'monk') {
    // O Monge perde esse benefício ao usar escudo.
    base = shieldEquipped ? 10 + dexMod : 10 + dexMod + wisMod;
    source = shieldEquipped ? 'Sem armadura (Monge com escudo)' : 'Defesa sem Armadura (Monge)';
  }

  const shieldBonus = shieldEquipped ? 2 : 0;
  const total = base + shieldBonus + (Number(miscBonus) || 0);

  return {
    total,
    base,
    shieldBonus,
    miscBonus: Number(miscBonus) || 0,
    source,
    stealthDisadvantage,
    strRequirement,
  };
}

/**
 * HP máximo do personagem.
 * Nível 1 (primeira classe) = dado de vida cheio; demais níveis = valor rolado
 * informado ou a média do dado (floor(d/2)+1). O modificador de CON se aplica
 * a cada nível, inclusive em multiclasse.
 *
 * @param {object} params
 * @param {Array<{classIndex:string, level:number, hitDie:number}>} params.classes
 * @param {number} params.conMod
 * @param {object} [params.hpRolls] { [classIndex]: number[] } valores rolados por nível
 *        (o índice 0 é ignorado, pois o nível 1 usa o dado cheio da classe inicial)
 * @param {string} [params.hpMode] 'average' | 'rolled'
 * @param {number} [params.bonusPerLevel] bônus fixo por nível (talentos/itens)
 */
export function computeMaxHp({
  classes = [],
  conMod = 0,
  hpRolls = {},
  hpMode = 'average',
  bonusPerLevel = 0,
} = {}) {
  const levelEntries = [];
  classes.forEach((entry) => {
    const levels = clampLevel(entry.level);
    const hitDie = Number(entry.hitDie) || 8;
    for (let index = 0; index < levels; index += 1) {
      levelEntries.push({ classIndex: entry.classIndex, ordinal: index, hitDie, firstEver: false });
    }
  });

  if (levelEntries.length === 0) {
    return { max: 0, perLevel: [], totalLevel: 0, mode: hpMode };
  }

  levelEntries[0].firstEver = true;

  const perLevel = levelEntries.map((entry) => {
    if (entry.firstEver) {
      return { ...entry, value: entry.hitDie, source: 'nível 1 (dado cheio)' };
    }
    if (hpMode === 'rolled') {
      const rolled = hpRolls?.[entry.classIndex]?.[entry.ordinal];
      const value = Number(rolled);
      if (Number.isFinite(value) && value > 0) {
        return { ...entry, value, source: 'rolado' };
      }
    }
    return { ...entry, value: Math.floor(entry.hitDie / 2) + 1, source: 'média' };
  });

  const totalLevel = levelEntries.length;
  const base = perLevel.reduce((sum, entry) => sum + entry.value, 0);
  const max = base + conMod * totalLevel + (Number(bonusPerLevel) || 0) * totalLevel;

  return { max: Math.max(1, max), perLevel, totalLevel, mode: hpMode };
}

/** Dados de vida totais por classe (total, usados e restantes). */
export function computeHitDice({ classes = [], hitDiceUsed = {} }) {
  return classes.map((entry) => {
    const total = clampLevel(entry.level);
    const used = Math.min(total, Math.max(0, Number(hitDiceUsed?.[entry.classIndex]) || 0));
    return {
      classIndex: entry.classIndex,
      die: Number(entry.hitDie) || 8,
      total,
      used,
      remaining: Math.max(0, total - used),
    };
  });
}

/** Ajuda o cliente a montar o rótulo de um atributo (mantém paridade com o backend). */
export function modifierFromScore(score) {
  return abilityModifier(score);
}
