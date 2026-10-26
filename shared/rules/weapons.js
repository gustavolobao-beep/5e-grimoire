/**
 * Constrói ataques roláveis a partir de armas do catálogo 5e,
 * já somando proficiência e modificador de atributo (ex.: "1d20 + 5").
 */

import { formatModifier } from './abilities.js';

/** Escolhe o atributo do ataque seguindo as regras de 5e. */
export function attackAbilityFor(weapon = {}) {
  const properties = (weapon.properties ?? []).map((property) =>
    String(property?.index ?? property ?? '').toLowerCase(),
  );
  const isRanged = String(weapon.weapon_range ?? '').toLowerCase() === 'ranged'
    || Number(weapon.range?.normal ?? 0) > 10;

  if (properties.includes('finesse')) return 'finesse';
  if (isRanged) return 'dex';
  if (properties.includes('thrown')) return 'str';
  return 'str';
}

/**
 * @param {object} item item de inventário (com `catalog` ou campos do SRD)
 * @param {object} context
 * @param {object} context.abilityMods { str: n, ... }
 * @param {number} context.profBonus
 * @param {boolean} [context.proficient] proficiência com a arma
 */
export function weaponAttackFromItem(item = {}, { abilityMods = {}, profBonus = 2, proficient = false } = {}) {
  const catalog = item.catalog ?? item;
  const damageDice = catalog.damage?.damage_dice
    ?? item.damageDice
    ?? (item.damage?.damage_dice);
  if (!damageDice) return null;

  const ability = attackAbilityFor({ ...catalog, ...item });
  const abilityMod = ability === 'finesse'
    ? Math.max(abilityMods.str ?? 0, abilityMods.dex ?? 0)
    : abilityMods[ability] ?? 0;

  const proficiencyPart = proficient ? profBonus : 0;
  const toHit = proficiencyPart + abilityMod;

  const twoHandedDice = catalog.two_handed_damage?.damage_dice ?? null;

  return {
    id: item.id ?? `inv-${item.itemIndex}`,
    itemIndex: item.itemIndex ?? catalog.index,
    name: item.name ?? catalog.name ?? 'Arma',
    equipped: item.equipped ?? true,
    ability: ability === 'finesse' ? 'finesse (DES/FOR)' : ability.toUpperCase(),
    proficient,
    toHit,
    attackExpression: `1d20${toHit >= 0 ? '+' : ''}${toHit}`,
    damageDice,
    damageBonus: abilityMod,
    damageExpression: `${damageDice}${abilityMod >= 0 ? '+' : ''}${abilityMod}`,
    damageBonusLabel: formatModifier(abilityMod),
    damageType: catalog.damage?.damage_type?.name ?? catalog.damage?.damage_type?.index ?? '',
    twoHandedDice,
    twoHandedExpression: twoHandedDice ? `${twoHandedDice}${abilityMod >= 0 ? '+' : ''}${abilityMod}` : null,
    range: catalog.range?.normal ? `${catalog.range.normal} pés${catalog.range.long ? ` / ${catalog.range.long} pés` : ''}` : null,
    properties: (catalog.properties ?? []).map((property) => property?.name ?? property),
    versatile: Boolean(twoHandedDice),
  };
}

/** Ataque desarmado padrão (1 + FOR de dano contundente). */
export function unarmedStrike({ abilityMods = {}, profBonus = 2 } = {}) {
  const strMod = abilityMods.str ?? 0;
  const toHit = profBonus + strMod;
  return {
    id: 'unarmed-strike',
    itemIndex: null,
    name: 'Ataque Desarmado',
    equipped: true,
    ability: 'STR',
    proficient: true,
    toHit,
    attackExpression: `1d20${toHit >= 0 ? '+' : ''}${toHit}`,
    damageDice: '1d1',
    damageBonus: strMod,
    damageExpression: `1${strMod >= 0 ? '+' : ''}${strMod}`,
    damageBonusLabel: formatModifier(strMod),
    damageType: 'Contundente',
    twoHandedDice: null,
    twoHandedExpression: null,
    range: null,
    properties: ['Desarmado'],
    versatile: false,
  };
}
