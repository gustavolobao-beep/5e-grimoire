/** Acesso a dados das ameaças (bestiário homebrew). */
import { all, get, run } from '../../db/connection.js';
import { parseJson, toJson } from '../../lib/json.js';

export function mapThreat(row, { includePayload = true } = {}) {
  if (!row) return null;
  const payload = parseJson(row.payload, {});
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    source: row.source,
    sourceIndex: row.source_index,
    isHomebrew: Boolean(row.is_homebrew),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(includePayload
      ? { payload }
      : {
        challengeRating: payload.challenge_rating ?? null,
        type: payload.type ?? null,
        size: payload.size ?? null,
        hitPoints: payload.hit_points ?? null,
        armorClass: payload.armor_class?.[0]?.value ?? null,
      }),
  };
}

export function listThreats(ownerId, { search, limit = 100, offset = 0 } = {}) {
  const params = [ownerId];
  let where = 'WHERE owner_id = ?';
  if (search) {
    where += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  return all(
    `SELECT * FROM threats ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  ).map((row) => mapThreat(row, { includePayload: false }));
}

export function findThreat(id) {
  return mapThreat(get('SELECT * FROM threats WHERE id = ?', [id]));
}

export function insertThreat(ownerId, { name, payload, source = 'custom', sourceIndex = null, isHomebrew = true }) {
  const result = run(
    `INSERT INTO threats (owner_id, name, source, source_index, payload, is_homebrew)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ownerId, name, source, sourceIndex, toJson(payload), isHomebrew],
  );
  return findThreat(Number(result.lastInsertRowid));
}

export function updateThreat(id, patch = {}) {
  const columns = {
    name: 'name',
    payload: 'payload',
    source: 'source',
    sourceIndex: 'source_index',
    isHomebrew: 'is_homebrew',
  };

  const assignments = [];
  const params = [];
  for (const [key, column] of Object.entries(columns)) {
    if (patch[key] === undefined) continue;
    let value = patch[key];
    if (key === 'payload') value = toJson(value);
    else if (typeof value === 'boolean') value = value ? 1 : 0;
    assignments.push(`${column} = ?`);
    params.push(value);
  }

  if (assignments.length === 0) return findThreat(id);
  assignments.push("updated_at = datetime('now')");
  run(`UPDATE threats SET ${assignments.join(', ')} WHERE id = ?`, [...params, id]);
  return findThreat(id);
}

export function deleteThreat(id) {
  run('DELETE FROM threats WHERE id = ?', [id]);
}
