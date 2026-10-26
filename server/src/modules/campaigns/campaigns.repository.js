/** Acesso a dados das campanhas e seus membros. */
import { all, get, run } from '../../db/connection.js';

export function mapCampaign(row) {
  if (!row) return null;
  return {
    id: row.id,
    dmId: row.dm_id,
    name: row.name,
    description: row.description,
    inviteCode: row.invite_code,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    characterId: row.character_id,
    role: row.role,
    joinedAt: row.joined_at,
    userName: row.user_name ?? null,
    userEmail: row.user_email ?? null,
    characterName: row.character_name ?? null,
  };
}

export function listCampaignsByDm(dmId) {
  return all('SELECT * FROM campaigns WHERE dm_id = ? ORDER BY updated_at DESC', [dmId]).map(mapCampaign);
}

export function listCampaignsByPlayer(userId) {
  return all(
    `SELECT c.* FROM campaigns c
     JOIN campaign_members m ON m.campaign_id = c.id
     WHERE m.user_id = ?
     ORDER BY c.updated_at DESC`,
    [userId],
  ).map(mapCampaign);
}

export function findCampaign(id) {
  return mapCampaign(get('SELECT * FROM campaigns WHERE id = ?', [id]));
}

export function findCampaignByInviteCode(code) {
  return mapCampaign(get('SELECT * FROM campaigns WHERE invite_code = ?', [String(code).toUpperCase()]));
}

export function insertCampaign({ dmId, name, description, inviteCode }) {
  const result = run(
    'INSERT INTO campaigns (dm_id, name, description, invite_code) VALUES (?, ?, ?, ?)',
    [dmId, name, description ?? null, inviteCode],
  );
  return findCampaign(Number(result.lastInsertRowid));
}

export function updateCampaign(id, patch = {}) {
  const columns = { name: 'name', description: 'description', status: 'status', inviteCode: 'invite_code' };
  const assignments = [];
  const params = [];
  for (const [key, column] of Object.entries(columns)) {
    if (patch[key] === undefined) continue;
    assignments.push(`${column} = ?`);
    params.push(patch[key]);
  }
  if (assignments.length === 0) return findCampaign(id);
  assignments.push("updated_at = datetime('now')");
  run(`UPDATE campaigns SET ${assignments.join(', ')} WHERE id = ?`, [...params, id]);
  return findCampaign(id);
}

export function deleteCampaign(id) {
  run('DELETE FROM campaigns WHERE id = ?', [id]);
}

export function listMembers(campaignId) {
  return all(
    `SELECT m.*, u.name AS user_name, u.email AS user_email, c.name AS character_name
     FROM campaign_members m
     LEFT JOIN users u ON u.id = m.user_id
     LEFT JOIN characters c ON c.id = m.character_id
     WHERE m.campaign_id = ?
     ORDER BY m.joined_at`,
    [campaignId],
  ).map(mapMember);
}

export function findMember(memberId) {
  return mapMember(get('SELECT * FROM campaign_members WHERE id = ?', [memberId]));
}

export function findMemberByUser(campaignId, userId) {
  return mapMember(
    get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', [campaignId, userId]),
  );
}

export function findMemberByCharacter(campaignId, characterId) {
  return mapMember(
    get('SELECT * FROM campaign_members WHERE campaign_id = ? AND character_id = ?', [campaignId, characterId]),
  );
}

export function addMember(campaignId, { userId, characterId, role = 'player' }) {
  const result = run(
    'INSERT INTO campaign_members (campaign_id, user_id, character_id, role) VALUES (?, ?, ?, ?)',
    [campaignId, userId ?? null, characterId ?? null, role],
  );
  return findMember(Number(result.lastInsertRowid));
}

export function removeMember(memberId) {
  run('DELETE FROM campaign_members WHERE id = ?', [memberId]);
}

/** Troca o personagem vinculado a um membro (jogador entra com outra ficha). */
export function updateMemberCharacter(memberId, characterId) {
  run('UPDATE campaign_members SET character_id = ? WHERE id = ?', [characterId, memberId]);
  return findMember(memberId);
}

export function campaignIdsForCharacter(characterId) {
  return all('SELECT campaign_id FROM campaign_members WHERE character_id = ?', [characterId])
    .map((row) => row.campaign_id);
}

export function isCampaignDm(campaignId, userId) {
  const row = get('SELECT id FROM campaigns WHERE id = ? AND dm_id = ?', [campaignId, userId]);
  return Boolean(row);
}

/** Personagens vinculados a uma campanha (para o Escudo do Mestre). */
export function characterIdsForCampaign(campaignId) {
  return all(
    'SELECT character_id FROM campaign_members WHERE campaign_id = ? AND character_id IS NOT NULL',
    [campaignId],
  ).map((row) => row.character_id);
}
