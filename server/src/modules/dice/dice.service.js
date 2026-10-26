/** Rolador de dados: resolve alvos da ficha, rola, registra e transmite em tempo real. */
import { rollD20, rollExpression } from '../../../../shared/rules/index.js';
import { all, get, run } from '../../db/connection.js';
import { parseJson } from '../../lib/json.js';
import { HttpError } from '../../lib/httpError.js';
import { emitToCampaign, emitToUser } from '../../realtime/io.js';
import * as characters from '../characters/characters.service.js';

function requireTarget(target) {
  if (!target?.kind) throw HttpError.badRequest('Informe "expression" ou "target".');
  return target;
}

/**
 * Traduz um alvo da ficha em expressão de dados + rótulo.
 * Ex.: { kind: 'skill', key: 'perception' } -> { expression: '1d20+5', label: 'Percepção' }
 */
export function resolveTarget({ userId, characterId, target, modifier = 0 }) {
  const hydrated = characters.getCharacterSheet(characterId);
  if (!hydrated) throw HttpError.notFound('Ficha não encontrada.');
  if (hydrated.character.userId !== userId) throw HttpError.forbidden('Esta ficha pertence a outro jogador.');

  const { sheet } = hydrated;
  const kind = requireTarget(target).kind;
  const fmt = (value) => `1d20${value >= 0 ? '+' : ''}${value}`;
  const extra = Number(modifier) || 0;

  switch (kind) {
    case 'ability': {
      const key = target.key;
      if (!(key in sheet.abilityMods)) throw HttpError.badRequest(`Atributo inválido: ${key}.`);
      return { expression: fmt(sheet.abilityMods[key] + extra), label: target.label ?? `Teste de ${key.toUpperCase()}` };
    }
    case 'save': {
      const save = sheet.savingThrows.find((entry) => entry.key === target.key);
      if (!save) throw HttpError.badRequest(`Resistência inválida: ${target.key}.`);
      return { expression: fmt(save.total + extra), label: target.label ?? `Resistência de ${target.key.toUpperCase()}` };
    }
    case 'skill': {
      const skill = sheet.skills.find((entry) => entry.key === target.key);
      if (!skill) throw HttpError.badRequest(`Perícia inválida: ${target.key}.`);
      return { expression: fmt(skill.total + extra), label: target.label ?? skill.name };
    }
    case 'attack': {
      const attack = sheet.attacks.find((entry) => String(entry.id) === String(target.key));
      if (!attack) throw HttpError.badRequest('Ataque não encontrado na ficha.');
      return { expression: attack.attackExpression, label: target.label ?? `Ataque: ${attack.name}` };
    }
    case 'damage': {
      const attack = sheet.attacks.find((entry) => String(entry.id) === String(target.key));
      if (!attack) throw HttpError.badRequest('Ataque não encontrado na ficha.');
      return { expression: attack.damageExpression, label: target.label ?? `Dano: ${attack.name}` };
    }
    case 'initiative':
      return { expression: fmt(sheet.initiative + extra), label: 'Iniciativa' };
    case 'death-save':
      return { expression: '1d20', label: 'Teste de Morte' };
    case 'spell-attack':
      return { expression: fmt((sheet.spellcasting?.attackBonus ?? 0) + extra), label: 'Ataque de Magia' };
    default:
      throw HttpError.badRequest(`Tipo de rolagem não suportado: ${kind}.`);
  }
}

function persist(entry) {
  const result = run(
    `INSERT INTO dice_rolls
       (campaign_id, character_id, user_id, user_name, label, expression, result, total, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.campaignId ?? null,
      entry.characterId ?? null,
      entry.userId,
      entry.userName ?? null,
      entry.label ?? null,
      entry.expression,
      JSON.stringify(entry.result),
      entry.total,
      entry.visibility ?? 'public',
    ],
  );

  const row = get('SELECT * FROM dice_rolls WHERE id = ?', [Number(result.lastInsertRowid)]);
  return { ...row, result: parseJson(row.result, {}) };
}

/** Executa a rolagem, grava o histórico e emite o evento. */
export function performRoll({ user, payload }) {
  const { characterId, expression, label, target, campaignId, visibility = 'public', modifier = 0 } = payload;

  let resolvedExpression = expression;
  let resolvedLabel = label ?? 'Rolagem livre';

  if (!resolvedExpression) {
    if (!characterId) throw HttpError.badRequest('Informe "expression" ou um "target" com "characterId".');
    const resolved = resolveTarget({ userId: user.id, characterId, target, modifier });
    resolvedExpression = resolved.expression;
    resolvedLabel = label ?? resolved.label;
  }

  const mode = payload.mode ?? 'normal';
  const isD20 = /^1d20([+-]\d+)?$/.test(String(resolvedExpression).toLowerCase());

  const result = isD20
    ? rollD20({
      modifier: Number(String(resolvedExpression).toLowerCase().split('d20')[1] || 0),
      mode,
      label: resolvedLabel,
    })
    : rollExpression(resolvedExpression);

  const entry = persist({
    campaignId: campaignId ?? null,
    characterId: characterId ?? null,
    userId: user.id,
    userName: user.name,
    label: resolvedLabel,
    expression: resolvedExpression,
    result,
    total: result.total,
    visibility,
  });

  // O Escudo do Mestre recebe as rolagens públicas em tempo real.
  if (campaignId) {
    emitToCampaign(Number(campaignId), 'dice:roll', entry);
  } else {
    emitToUser(user.id, 'dice:roll', entry);
  }

  return entry;
}

export function listLog({ campaignId, userId, limit = 30 }) {
  const rows = campaignId
    ? all(
      'SELECT * FROM dice_rolls WHERE campaign_id = ? AND visibility != ? ORDER BY id DESC LIMIT ?',
      [campaignId, 'dm', limit],
    )
    : all(
      'SELECT * FROM dice_rolls WHERE campaign_id IS NULL AND user_id = ? ORDER BY id DESC LIMIT ?',
      [userId, limit],
    );

  return rows.map((row) => ({ ...row, result: parseJson(row.result, {}) }));
}

export function clearLog({ campaignId, userId }) {
  if (campaignId) {
    run('DELETE FROM dice_rolls WHERE campaign_id = ?', [campaignId]);
  } else {
    run('DELETE FROM dice_rolls WHERE campaign_id IS NULL AND user_id = ?', [userId]);
  }
  return { cleared: true };
}
