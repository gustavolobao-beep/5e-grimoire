/**
 * As 18 perícias de D&D 5e com seus atributos padrão.
 */

export const SKILLS = [
  { key: 'acrobatics', name: 'Acrobacia', ability: 'dex' },
  { key: 'animal-handling', name: 'Adestrar Animais', ability: 'wis' },
  { key: 'arcana', name: 'Arcanismo', ability: 'int' },
  { key: 'athletics', name: 'Atletismo', ability: 'str' },
  { key: 'performance', name: 'Atuação', ability: 'cha' },
  { key: 'deception', name: 'Enganação', ability: 'cha' },
  { key: 'stealth', name: 'Furtividade', ability: 'dex' },
  { key: 'history', name: 'História', ability: 'int' },
  { key: 'intimidation', name: 'Intimidação', ability: 'cha' },
  { key: 'insight', name: 'Intuição', ability: 'wis' },
  { key: 'investigation', name: 'Investigação', ability: 'int' },
  { key: 'medicine', name: 'Medicina', ability: 'wis' },
  { key: 'nature', name: 'Natureza', ability: 'int' },
  { key: 'perception', name: 'Percepção', ability: 'wis' },
  { key: 'persuasion', name: 'Persuasão', ability: 'cha' },
  { key: 'sleight-of-hand', name: 'Prestidigitação', ability: 'dex' },
  { key: 'religion', name: 'Religião', ability: 'int' },
  { key: 'survival', name: 'Sobrevivência', ability: 'wis' },
];

export const SKILL_KEYS = SKILLS.map((skill) => skill.key);

export const SKILL_BY_KEY = Object.fromEntries(SKILLS.map((skill) => [skill.key, skill]));

/**
 * Bônus final de uma perícia.
 * @param {object} params
 * @param {string} params.ability chave do atributo base
 * @param {number} params.abilityMod modificador do atributo
 * @param {number} params.proficiencyBonus bônus de proficiência total
 * @param {boolean} [params.proficient] possui proficiência
 * @param {boolean} [params.expertise] possui expertise (dobra o bônus)
 * @param {number} [params.miscBonus] outros bônus
 * @param {boolean} [params.includeHalfProficiency] meio bônus de proficiência (ex.: Meio Proficiente do Bardo)
 */
export function skillBonus({
  abilityMod = 0,
  proficiencyBonus: prof = 0,
  proficient = false,
  expertise = false,
  miscBonus = 0,
  includeHalfProficiency = false,
} = {}) {
  let total = Number(abilityMod) || 0;
  if (expertise) total += prof * 2;
  else if (proficient) total += prof;
  else if (includeHalfProficiency) total += Math.floor(prof / 2);
  return total + (Number(miscBonus) || 0);
}
