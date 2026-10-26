/**
 * Utilitários de formatação e rótulos de exibição.
 * Os cálculos vêm do motor compartilhado (shared/rules), usado pelo backend;
 * aqui só cuidamos da apresentação.
 */
import { ABILITY_KEYS, formatModifier } from '@shared/rules/index.js';

export const ABILITY_LABELS = {
  str: 'Força',
  dex: 'Destreza',
  con: 'Constituição',
  int: 'Inteligência',
  wis: 'Sabedoria',
  cha: 'Carisma',
};

export { ABILITY_KEYS, formatModifier };

export const ABILITY_ABBR = {
  str: 'FOR',
  dex: 'DES',
  con: 'CON',
  int: 'INT',
  wis: 'SAB',
  cha: 'CAR',
};

export const SPELL_SCHOOL_LABELS = {
  abjuration: 'Abjuração',
  conjuration: 'Conjuração',
  divination: 'Adivinhação',
  enchantment: 'Encantamento',
  evocation: 'Evocação',
  illusion: 'Ilusão',
  necromancy: 'Necromancia',
  transmutation: 'Transmutação',
};

export const SPELL_LEVEL_LABELS = [
  'Truque',
  '1º círculo',
  '2º círculo',
  '3º círculo',
  '4º círculo',
  '5º círculo',
  '6º círculo',
  '7º círculo',
  '8º círculo',
  '9º círculo',
];

/** "1d20+5" -> { count, faces, modifier } para exibir bonitinho. */
export function splitD20(expression) {
  const match = /^1d20([+-]\d+)?$/i.exec(String(expression ?? '').trim());
  return match ? Number(match[1] ?? 0) : null;
}

export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatRelativeDate(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d atrás`;
  return date.toLocaleDateString('pt-BR');
}

/** Iniciais para o avatar redondo (ex.: "Lia, a Ladina" -> "LL"). */
export function initials(name) {
  return String(name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
