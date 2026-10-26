/**
 * Bônus de proficiência por nível de personagem (usa o nível TOTAL,
 * inclusive em personagens multiclasse, conforme as regras de 5e).
 */

export const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export const MAX_CHARACTER_LEVEL = 20;

/** Bônus de proficiência: +2 (níveis 1-4) até +6 (níveis 17-20). */
export function proficiencyBonus(totalLevel) {
  const level = clampLevel(totalLevel);
  return Math.floor((level - 1) / 4) + 2;
}

export function clampLevel(level) {
  const value = Number(level) || 0;
  return Math.min(MAX_CHARACTER_LEVEL, Math.max(0, Math.trunc(value)));
}

/** Nível de personagem a partir do XP acumulado. */
export function levelFromXp(xp = 0) {
  const value = Number(xp) || 0;
  let level = 1;
  for (let index = 0; index < XP_THRESHOLDS.length; index += 1) {
    if (value >= XP_THRESHOLDS[index]) level = index + 1;
  }
  return level;
}

/** XP mínimo para atingir um nível. */
export function xpForLevel(level) {
  return XP_THRESHOLDS[clampLevel(level) - 1] ?? 0;
}
