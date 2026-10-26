/**
 * Ameaças (monstros): busca no bestiário do SRD, criação/edição de fichas
 * homebrew e conversão do statblock em rolagens prontas para o Mestre.
 */
import { monsterCombatProfile } from '../../../../shared/rules/index.js';
import { HttpError } from '../../lib/httpError.js';
import * as catalog from '../catalog/catalog.repository.js';
import * as repo from './threats.repository.js';

/** Bestiário do SRD com filtros de busca. */
export function searchBestiary(filters = {}) {
  const { items, total } = catalog.listMonsters({
    search: filters.search,
    type: filters.type,
    size: filters.size,
    crMin: filters.crMin,
    crMax: filters.crMax,
    limit: filters.limit ?? 60,
    offset: filters.offset ?? 0,
  });

  return {
    total,
    items: items.map((monster) => ({
      index: monster.index,
      name: monster.name,
      challengeRating: monster.cr,
      type: monster.type,
      size: monster.size,
      xp: monster.xp,
      hitPoints: monster.data.hit_points ?? null,
      armorClass: monster.data.armor_class?.[0]?.value ?? null,
    })),
  };
}

/** Statblock completo + perfil rolável de um monstro do SRD. */
export function getBestiaryMonster(index) {
  const monster = catalog.findMonster(index);
  if (!monster) throw HttpError.notFound('Monstro não encontrado no bestiário.');
  return { statblock: monster.data, profile: monsterCombatProfile(monster.data), source: 'srd', id: null };
}

export function bestiaryMeta() {
  return { types: catalog.monsterTypes() };
}

export function listHomebrew(userId, filters = {}) {
  const items = repo.listThreats(userId, filters);
  return { items, total: items.length };
}

function requireOwnThreat(id, userId) {
  const threat = repo.findThreat(id);
  if (!threat) throw HttpError.notFound('Ameaça não encontrada.');
  if (threat.ownerId !== userId) throw HttpError.forbidden('Esta ameaça pertence a outro Mestre.');
  return threat;
}

export function getThreat(id, userId) {
  const threat = requireOwnThreat(id, userId);
  return { threat, statblock: threat.payload, profile: monsterCombatProfile(threat.payload), source: threat.source, id: threat.id };
}

export function createThreat(userId, payload) {
  const threat = repo.insertThreat(userId, {
    name: payload.name,
    payload: { ...payload.payload, name: payload.payload?.name ?? payload.name },
    source: payload.source ?? 'custom',
    sourceIndex: payload.sourceIndex ?? null,
    isHomebrew: payload.isHomebrew ?? true,
  });
  return getThreat(threat.id, userId);
}

/** Importa um monstro do SRD para o bestiário pessoal (permite editar PV, etc.). */
export function importFromSrd(userId, index) {
  const monster = catalog.findMonster(index);
  if (!monster) throw HttpError.notFound('Monstro não encontrado no bestiário.');

  const threat = repo.insertThreat(userId, {
    name: monster.data.name,
    payload: monster.data,
    source: 'srd',
    sourceIndex: monster.index,
    isHomebrew: false,
  });
  return getThreat(threat.id, userId);
}

export function updateThreat(id, userId, patch) {
  requireOwnThreat(id, userId);
  const current = repo.findThreat(id);
  const payload = patch.payload
    ? { ...current.payload, ...patch.payload, name: patch.payload.name ?? patch.name ?? current.name }
    : undefined;

  repo.updateThreat(id, { ...patch, ...(payload ? { payload } : {}) });
  return getThreat(id, userId);
}

export function deleteThreat(id, userId) {
  requireOwnThreat(id, userId);
  repo.deleteThreat(id);
  return { deleted: true, id };
}

/** Atalho para ajustar PV de uma ameaça durante o combate. */
export function patchThreatHp(id, userId, { delta, current, temp }) {
  const threat = requireOwnThreat(id, userId);
  const patch = {};

  if (temp !== undefined) patch.temp_hp = temp;
  if (current !== undefined) patch.hit_points = current;
  else if (delta !== undefined) patch.hit_points = Math.max(0, (Number(threat.payload.hit_points) || 0) + delta);

  const payload = { ...threat.payload, ...patch };
  repo.updateThreat(id, { payload });
  return getThreat(id, userId);
}
