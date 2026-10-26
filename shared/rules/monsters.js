/**
 * Perfil de combate de uma ameaça (monstro): transforma o statblock do SRD em
 * valores roláveis para os botões do bestiário (ataques, dano, resistências).
 */

import { ABILITY_KEYS, abilityModifier, formatModifier } from './abilities.js';
import { skillBonus } from './skills.js';

const MONSTER_ABILITY_FIELD = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
};

/** Bônus de proficiência aproximado pela CR (tabela do Livro do Mestre). */
export function monsterProficiencyBonus(challengeRating = 0) {
  const cr = Number(challengeRating) || 0;
  if (cr < 5) return 2;
  if (cr < 9) return 3;
  if (cr < 13) return 4;
  if (cr < 17) return 5;
  if (cr < 21) return 6;
  if (cr < 25) return 7;
  if (cr < 29) return 8;
  return 9;
}

const toArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

/** CA principal do monstro (o primeiro item da lista do SRD). */
export function monsterArmorClass(monster = {}) {
  const entries = monster.armor_class ?? [];
  if (entries.length === 0) return null;
  const primary = entries[0];
  if (typeof primary === 'number') return { value: primary, type: 'natural' };
  return { value: primary.value, type: primary.type ?? 'natural' };
}

/** Deslocamento legível ("9 m / voo 18 m"). */
export function monsterSpeedLabel(speed = {}) {
  const labels = { walk: 'deslocamento', fly: 'voo', swim: 'natação', climb: 'escalada', burrow: 'escavação', hover: 'pairar' };
  return Object.entries(speed)
    .map(([key, value]) => (key === 'walk' ? value : `${labels[key] ?? key} ${value}`))
    .join(' · ');
}

/** Modificadores dos seis atributos. */
export function monsterAbilities(monster = {}) {
  return Object.fromEntries(
    ABILITY_KEYS.map((key) => {
      const score = Number(monster[MONSTER_ABILITY_FIELD[key]]) || 10;
      return [key, { score, mod: abilityModifier(score), label: formatModifier(abilityModifier(score)) }];
    }),
  );
}

/**
 * Proficiências do monstro já com o valor final (o SRD já informa o total).
 * Ex.: "saving-throw-wis" -> resistência de Sabedoria +4.
 */
export function monsterProficiencies(monster = {}) {
  const entries = monster.proficiencies ?? [];
  const savingThrows = Object.fromEntries(ABILITY_KEYS.map((key) => [key, null]));
  const skills = [];

  for (const entry of entries) {
    const index = entry.proficiency?.index ?? '';
    const value = Number(entry.value);

    const saveMatch = index.match(/^saving-throw-(\w+)$/);
    if (saveMatch && ABILITY_KEYS.includes(saveMatch[1])) {
      savingThrows[saveMatch[1]] = { bonus: value, label: formatModifier(value) };
      continue;
    }

    const skillMatch = index.match(/^skill-(.+)$/);
    if (skillMatch) {
      skills.push({
        key: skillMatch[1],
        name: entry.proficiency.name?.replace(/^Skill:\s*/, '') ?? skillMatch[1],
        bonus: value,
        label: formatModifier(value),
      });
    }
  }

  return { savingThrows, skills };
}

/**
 * Ações lendárias/ataques do statblock convertidos em rolagens.
 * Devolve, para cada ação, as expressões de ataque, dano e CD de resistência.
 */
export function monsterActions(monster = {}, { profBonus } = {}) {
  const abilities = monsterAbilities(monster);
  const prof = profBonus ?? monsterProficiencyBonus(monster.challenge_rating);

  const buildFromAction = (action, group) => {
    const attackBonuses = toArray(action.attack_bonus).filter((value) => Number.isFinite(Number(value)));
    const damages = toArray(action.damage);
    const damageBonuses = toArray(action.damage_bonus);

    const attackRolls = attackBonuses.map((bonus, index) => ({
      label: attackBonuses.length > 1 ? `Ataque ${index + 1}` : 'Ataque',
      expression: `1d20${Number(bonus) >= 0 ? '+' : ''}${Number(bonus)}`,
      modifier: Number(bonus),
    }));

    const damageRolls = damages.map((damage, index) => {
      const dice = damage.damage_dice ?? '';
      const bonus = Number(damageBonuses[index] ?? 0);
      const normalized = /[+-]/.test(dice) ? dice : `${dice}${bonus ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : ''}`;
      return {
        label: damages.length > 1 ? `Dano ${index + 1}` : 'Dano',
        expression: normalized || null,
        type: damage.damage_type?.name ?? damage.damage_type?.index ?? '',
      };
    }).filter((entry) => entry.expression);

    const save = action.dc
      ? {
        ability: action.dc.dc_type?.index ?? null,
        abilityName: action.dc.dc_type?.name ?? '',
        dc: action.dc.dc_value,
        successType: action.dc.success_type ?? null,
        label: `CD ${action.dc.dc_value} ${action.dc.dc_type?.name ?? ''} (${action.dc.success_type ?? ''})`.trim(),
      }
      : null;

    return {
      group,
      name: action.name,
      description: (action.desc ?? '').toString(),
      attackRolls,
      damageRolls,
      save,
      usages: action.usage ? `${action.usage.type} ${action.usage.times ?? ''}/${action.usage.rest_type ?? ''}`.trim() : null,
    };
  };

  return {
    actions: (monster.actions ?? []).map((action) => buildFromAction(action, 'action')),
    legendary: (monster.legendary_actions ?? []).map((action) => buildFromAction(action, 'legendary')),
    reactions: (monster.reactions ?? []).map((action) => buildFromAction(action, 'reaction')),
    specialAbilities: (monster.special_abilities ?? []).map((ability) => ({
      name: ability.name,
      description: (ability.desc ?? '').toString(),
      spellcasting: ability.spellcasting ?? null,
    })),
    profBonus: prof,
    abilities,
  };
}

/** Perfil completo pronto para renderizar no bestiário. */
export function monsterCombatProfile(monster = {}) {
  const profBonus = monsterProficiencyBonus(monster.challenge_rating);
  const { savingThrows, skills } = monsterProficiencies(monster);

  return {
    index: monster.index,
    name: monster.name,
    size: monster.size,
    type: monster.type,
    subtype: monster.subtype ?? null,
    alignment: monster.alignment,
    armorClass: monsterArmorClass(monster),
    hitPoints: monster.hit_points,
    hitDice: monster.hit_dice,
    hitPointsRoll: monster.hit_points_roll,
    speed: monster.speed,
    speedLabel: monsterSpeedLabel(monster.speed),
    challengeRating: monster.challenge_rating,
    xp: monster.xp,
    profBonus,
    abilities: monsterAbilities(monster),
    savingThrows,
    skills,
    senses: monster.senses ?? {},
    languages: monster.languages ?? '',
    damageResistances: monster.damage_resistances ?? [],
    damageImmunities: monster.damage_immunities ?? [],
    conditionImmunities: monster.condition_immunities ?? [],
    ...monsterActions(monster, { profBonus }),
  };
}

/** Reexporta o helper de perícia para casos em que o cliente já tem o bônus base. */
export { skillBonus };
