/**
 * Atributos base de D&D 5e e utilidades de conversão.
 * Módulo puro (sem dependências) para ser usado tanto pelo backend quanto pelo frontend.
 */

export const ABILITIES = [
  { key: 'str', short: 'FOR', name: 'Força' },
  { key: 'dex', short: 'DES', name: 'Destreza' },
  { key: 'con', short: 'CON', name: 'Constituição' },
  { key: 'int', short: 'INT', name: 'Inteligência' },
  { key: 'wis', short: 'SAB', name: 'Sabedoria' },
  { key: 'cha', short: 'CAR', name: 'Carisma' },
];

export const ABILITY_KEYS = ABILITIES.map((ability) => ability.key);

export const ABILITY_LABELS = Object.fromEntries(
  ABILITIES.map((ability) => [ability.key, ability.name]),
);

/** Modificador de atributo: floor((valor - 10) / 2). */
export function abilityModifier(score) {
  const value = Number(score);
  return Math.floor(((Number.isFinite(value) ? value : 10) - 10) / 2);
}

/** Formata um modificador com sinal: 5 -> "+5", -1 -> "-1". */
export function formatModifier(modifier) {
  const value = Number(modifier) || 0;
  return value >= 0 ? `+${value}` : `${value}`;
}

/** Normaliza um objeto de atributos garantindo as 6 chaves numéricas. */
export function normalizeAbilities(abilities = {}) {
  return Object.fromEntries(
    ABILITY_KEYS.map((key) => [key, Number(abilities?.[key]) || 10]),
  );
}

/** Mapa { atributo: modificador }. */
export function abilityModifiers(abilities = {}) {
  return Object.fromEntries(
    ABILITY_KEYS.map((key) => [key, abilityModifier(abilities?.[key])]),
  );
}
