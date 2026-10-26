/**
 * Notificações em tempo real quando uma ficha muda.
 * Mantém o dashboard do jogador e o Escudo do Mestre sincronizados.
 */
import { emitToCampaign, emitToUser } from '../../realtime/io.js';
import { campaignIdsForCharacter } from '../campaigns/campaigns.repository.js';
import { getCharacterSheet } from './characters.service.js';

export function notifyCharacterUpdate(characterId) {
  const hydrated = getCharacterSheet(characterId);
  if (!hydrated) return null;

  emitToUser(hydrated.character.userId, 'character:updated', {
    characterId,
    summary: hydrated.summary,
  });

  for (const campaignId of campaignIdsForCharacter(characterId)) {
    emitToCampaign(campaignId, 'party:updated', {
      campaignId,
      characterId,
      summary: hydrated.summary,
    });
  }

  return hydrated.summary;
}
