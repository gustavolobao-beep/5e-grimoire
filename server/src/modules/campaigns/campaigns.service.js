/**
 * Regras de negócio das campanhas e do Escudo do Mestre.
 */
import { generateInviteCode } from '../../lib/auth.js';
import { HttpError } from '../../lib/httpError.js';
import * as charactersRepo from '../characters/characters.repository.js';
import { hydrateCharacters, requireCharacter } from '../characters/characters.service.js';
import { notifyCharacterUpdate } from '../characters/characters.events.js';
import * as repo from './campaigns.repository.js';

function uniqueInviteCode() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateInviteCode();
    if (!repo.findCampaignByInviteCode(code)) return code;
  }
  throw new HttpError(500, 'Não foi possível gerar um código de convite único.');
}

/** Garante acesso à campanha (DM ou jogador membro). */
export function requireCampaignAccess(campaignId, userId) {
  const campaign = repo.findCampaign(campaignId);
  if (!campaign) throw HttpError.notFound('Campanha não encontrada.');

  const isDm = campaign.dmId === userId;
  const member = repo.findMemberByUser(campaignId, userId);
  if (!isDm && !member) throw HttpError.forbidden('Você não participa desta campanha.');

  return { campaign, isDm, member };
}

export function requireCampaignDm(campaignId, userId) {
  const { campaign, isDm } = requireCampaignAccess(campaignId, userId);
  if (!isDm) throw HttpError.forbidden('Apenas o Mestre pode executar esta ação.');
  return campaign;
}

/** Visão do dashboard: campanhas que mestra + campanhas que joga. */
export function listForUser(userId) {
  const mastering = repo.listCampaignsByDm(userId).map((campaign) => ({
    ...campaign,
    role: 'dm',
    memberCount: repo.listMembers(campaign.id).filter((member) => member.characterId).length,
  }));

  const playing = repo.listCampaignsByPlayer(userId).map((campaign) => {
    const membership = repo.findMemberByUser(campaign.id, userId);
    return {
      ...campaign,
      role: 'player',
      membershipId: membership?.id ?? null,
      characterId: membership?.characterId ?? null,
      characterName: membership?.characterName ?? null,
    };
  });

  return { mastering, playing };
}

export function createCampaign(userId, { name, description }) {
  return repo.insertCampaign({
    dmId: userId,
    name,
    description: description ?? null,
    inviteCode: uniqueInviteCode(),
  });
}

export function getCampaign(campaignId, userId) {
  const { campaign, isDm, member } = requireCampaignAccess(campaignId, userId);
  const members = repo.listMembers(campaignId);

  const characterIds = members.map((entry) => entry.characterId).filter(Boolean);
  const summaries = new Map(
    hydrateCharacters(charactersRepo.charactersByIds(characterIds))
      .map((entry) => [entry.character.id, entry.summary]),
  );

  return {
    campaign,
    isDm,
    myMembership: member,
    members: members.map((entry) => ({
      ...entry,
      summary: entry.characterId ? summaries.get(entry.characterId) ?? null : null,
    })),
    inviteCode: isDm ? campaign.inviteCode : undefined,
  };
}

export function updateCampaign(campaignId, userId, patch) {
  requireCampaignDm(campaignId, userId);
  return repo.updateCampaign(campaignId, patch);
}

export function deleteCampaign(campaignId, userId) {
  requireCampaignDm(campaignId, userId);
  repo.deleteCampaign(campaignId);
  return { deleted: true, id: campaignId };
}

export function regenerateInviteCode(campaignId, userId) {
  requireCampaignDm(campaignId, userId);
  return repo.updateCampaign(campaignId, { inviteCode: uniqueInviteCode() });
}

/** Entrada na campanha via link/código de convite. */
export function joinCampaign(userId, { inviteCode, characterId }) {
  const campaign = repo.findCampaignByInviteCode(inviteCode);
  if (!campaign) throw HttpError.notFound('Código de convite inválido.');
  if (campaign.dmId === userId) throw HttpError.badRequest('Você é o Mestre desta campanha.');

  const character = requireCharacter(characterId, userId);
  if (repo.findMemberByCharacter(campaign.id, character.id)) {
    throw HttpError.conflict('Este personagem já está nesta campanha.');
  }

  const existing = repo.findMemberByUser(campaign.id, userId);
  const member = existing
    ? repo.updateMemberCharacter(existing.id, character.id)
    : repo.addMember(campaign.id, { userId, characterId: character.id, role: 'player' });

  return { campaign, member };
}

export function removeMember(campaignId, userId, memberId) {
  const { campaign, isDm } = requireCampaignAccess(campaignId, userId);
  const member = repo.findMember(memberId);
  if (!member || member.campaignId !== campaign.id) throw HttpError.notFound('Membro não encontrado.');

  const isSelf = member.userId === userId;
  if (!isDm && !isSelf) throw HttpError.forbidden('Você só pode sair da campanha com a sua própria ficha.');

  repo.removeMember(memberId);
  return { removed: true, memberId };
}

/**
 * Escudo do Mestre: todos os personagens da campanha já calculados,
 * com dados rápidos (PV, CA, Percepção Passiva) e rolagens prontas.
 */
export function masterShield(campaignId, userId) {
  const campaign = requireCampaignDm(campaignId, userId);
  const members = repo.listMembers(campaignId);
  const characterIds = members.map((entry) => entry.characterId).filter(Boolean);
  const hydrated = hydrateCharacters(charactersRepo.charactersByIds(characterIds));
  const byCharacterId = new Map(hydrated.map((entry) => [entry.character.id, entry]));

  const party = members.map((member) => {
    const entry = member.characterId ? byCharacterId.get(member.characterId) : null;

    if (!entry) {
      return {
        memberId: member.id,
        userId: member.userId,
        userName: member.userName,
        role: member.role,
        characterId: member.characterId,
        characterName: member.characterName,
        summary: null,
        attacks: [],
        spellSlots: null,
        savingThrows: [],
        skills: [],
      };
    }

    return {
      memberId: member.id,
      userId: member.userId,
      userName: member.userName,
      role: member.role,
      characterId: entry.character.id,
      characterName: entry.character.name,
      summary: entry.summary,
      // Informações extras que o Mestre precisa ter à mão sem abrir a ficha:
      attacks: entry.sheet.attacks.map((attack) => ({
        id: attack.id,
        name: attack.name,
        attackExpression: attack.attackExpression,
        damageExpression: attack.damageExpression,
        damageType: attack.damageType,
      })),
      savingThrows: entry.sheet.savingThrows.map((save) => ({ key: save.key, total: save.total, proficient: save.proficient })),
      skills: entry.sheet.skills
        .filter((skill) => skill.proficient || skill.expertise)
        .map((skill) => ({ key: skill.key, name: skill.name, total: skill.total })),
      spellSlots: {
        slots: entry.sheet.spellSlots.slots,
        used: entry.sheet.spellSlots.used,
        pact: entry.sheet.spellSlots.pact,
        pactUsed: entry.sheet.spellSlots.pactUsed,
        saveDc: entry.sheet.spellcasting?.saveDc ?? null,
      },
      hitDice: entry.sheet.hitDice,
      conditions: entry.character.conditions ?? [],
      warnings: entry.sheet.warnings,
    };
  });

  return { campaign, party };
}

/** O Mestre aplica dano/cura direto na ficha do jogador (sincroniza em tempo real). */
export function masterAdjustHp(campaignId, userId, characterId, { delta, current, temp }) {
  requireCampaignDm(campaignId, userId);

  const member = repo.findMemberByCharacter(campaignId, characterId);
  if (!member) throw HttpError.notFound('Este personagem não está na campanha.');

  const hydrated = hydrateCharacters(charactersRepo.charactersByIds([characterId]))[0];
  if (!hydrated) throw HttpError.notFound('Personagem não encontrado.');

  const max = hydrated.sheet.hp.max;
  const patch = {};

  if (temp !== undefined) patch.hpTemp = temp;
  if (current !== undefined) patch.hpCurrent = Math.max(0, Math.min(max, current));
  else if (delta !== undefined) {
    patch.hpCurrent = Math.max(0, Math.min(max, (hydrated.character.hpCurrent ?? max) + delta));
  }

  charactersRepo.updateCharacter(characterId, patch);
  notifyCharacterUpdate(characterId);

  return hydrateCharacters(charactersRepo.charactersByIds([characterId]))[0];
}
