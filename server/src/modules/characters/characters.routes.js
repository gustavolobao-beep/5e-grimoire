/**
 * Rotas das fichas de personagem.
 * Toda mutação responde com a ficha recalculada e dispara eventos de tempo real.
 */
import { Router } from 'express';
import { asyncHandler } from '../../lib/httpError.js';
import { validate } from '../../lib/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { notifyCharacterUpdate } from './characters.events.js';
import * as service from './characters.service.js';
import * as schemas from './characters.schemas.js';

export const charactersRouter = Router();
charactersRouter.use(authenticate);

const respond = (res, characterId, extra = {}) => {
  const hydrated = service.getCharacterSheet(characterId);
  notifyCharacterUpdate(characterId);
  res.json({ ...hydrated, ...extra });
};

charactersRouter.get('/', asyncHandler((req, res) => {
  const items = service.listUserCharacters(req.user.id);
  if (req.query.full === 'true') {
    res.json({ items });
    return;
  }
  res.json({ items: items.map((entry) => entry.summary) });
}));

charactersRouter.post('/', asyncHandler((req, res) => {
  const payload = validate(schemas.createCharacterSchema, req.body);
  const created = service.createCharacter(req.user.id, payload);
  notifyCharacterUpdate(created.character.id);
  res.status(201).json(created);
}));

charactersRouter.get('/:id', asyncHandler((req, res) => {
  service.requireCharacter(Number(req.params.id), req.user.id);
  res.json(service.getCharacterSheet(Number(req.params.id)));
}));

charactersRouter.patch('/:id', asyncHandler((req, res) => {
  const payload = validate(schemas.updateCharacterSchema, req.body);
  service.updateCharacter(Number(req.params.id), req.user.id, payload);
  respond(res, Number(req.params.id));
}));

charactersRouter.delete('/:id', asyncHandler((req, res) => {
  res.json(service.deleteCharacter(Number(req.params.id), req.user.id));
}));

/** Ajuste rápido de PV (dano, cura, PV temporário) — usado pela ficha e pelo DM. */
charactersRouter.patch('/:id/hp', asyncHandler((req, res) => {
  const payload = validate(schemas.hpPatchSchema, req.body);
  service.patchHp(Number(req.params.id), req.user.id, payload);
  respond(res, Number(req.params.id));
}));

charactersRouter.put('/:id/classes', asyncHandler((req, res) => {
  const payload = validate(schemas.classesPayloadSchema, req.body);
  const result = service.updateClasses(Number(req.params.id), req.user.id, payload);
  notifyCharacterUpdate(Number(req.params.id));
  res.json(result);
}));

/** Descanso curto (recupera slots de pacto) ou longo (PV, slots e dados de vida). */
charactersRouter.post('/:id/rest', asyncHandler((req, res) => {
  service.rest(Number(req.params.id), req.user.id, { type: req.body?.type === 'short' ? 'short' : 'long' });
  respond(res, Number(req.params.id));
}));

// ---------------------------------------------------------------------------
// Inventário
// ---------------------------------------------------------------------------
charactersRouter.post('/:id/inventory', asyncHandler((req, res) => {
  const payload = validate(schemas.inventoryItemSchema, req.body);
  service.addInventoryItem(Number(req.params.id), req.user.id, payload);
  respond(res, Number(req.params.id));
}));

charactersRouter.patch('/:id/inventory/:itemId', asyncHandler((req, res) => {
  const payload = validate(schemas.inventoryPatchSchema, req.body);
  service.updateInventoryItem(Number(req.params.id), req.user.id, Number(req.params.itemId), payload);
  respond(res, Number(req.params.id));
}));

charactersRouter.delete('/:id/inventory/:itemId', asyncHandler((req, res) => {
  service.removeInventoryItem(Number(req.params.id), req.user.id, Number(req.params.itemId));
  respond(res, Number(req.params.id));
}));

// ---------------------------------------------------------------------------
// Magias
// ---------------------------------------------------------------------------
charactersRouter.post('/:id/spells', asyncHandler((req, res) => {
  const payload = validate(schemas.spellEntrySchema, req.body);
  service.addSpell(Number(req.params.id), req.user.id, payload);
  respond(res, Number(req.params.id));
}));

charactersRouter.patch('/:id/spells/:spellId', asyncHandler((req, res) => {
  const payload = validate(schemas.spellPatchSchema, req.body);
  service.updateSpell(Number(req.params.id), req.user.id, Number(req.params.spellId), payload);
  respond(res, Number(req.params.id));
}));

charactersRouter.delete('/:id/spells/:spellId', asyncHandler((req, res) => {
  service.removeSpell(Number(req.params.id), req.user.id, Number(req.params.spellId));
  respond(res, Number(req.params.id));
}));
