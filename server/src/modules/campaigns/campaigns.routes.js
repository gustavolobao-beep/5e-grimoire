/** Rotas de campanhas, convites e Escudo do Mestre. */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/httpError.js';
import { validate } from '../../lib/validate.js';
import { authenticate } from '../../middleware/auth.js';
import * as service from './campaigns.service.js';

export const campaignsRouter = Router();
campaignsRouter.use(authenticate);

const createSchema = z.object({
  name: z.string().trim().min(2, 'Dê um nome à campanha.').max(120),
  description: z.string().trim().max(2000).nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['active', 'paused', 'finished']).optional(),
});

const joinSchema = z.object({
  inviteCode: z.string().trim().min(4).max(16),
  characterId: z.number().int().positive('Escolha um personagem.'),
});

const hpSchema = z.object({
  delta: z.number().int().min(-999).max(999).optional(),
  current: z.number().int().min(0).max(9999).optional(),
  temp: z.number().int().min(0).max(999).optional(),
}).refine((value) => value.delta !== undefined || value.current !== undefined || value.temp !== undefined, {
  message: 'Informe "delta", "current" ou "temp".',
});

campaignsRouter.get('/', asyncHandler((req, res) => {
  res.json(service.listForUser(req.user.id));
}));

campaignsRouter.post('/', asyncHandler((req, res) => {
  const payload = validate(createSchema, req.body);
  res.status(201).json({ campaign: service.createCampaign(req.user.id, payload) });
}));

campaignsRouter.post('/join', asyncHandler((req, res) => {
  const payload = validate(joinSchema, req.body);
  res.json(service.joinCampaign(req.user.id, payload));
}));

campaignsRouter.get('/:id', asyncHandler((req, res) => {
  res.json(service.getCampaign(Number(req.params.id), req.user.id));
}));

campaignsRouter.patch('/:id', asyncHandler((req, res) => {
  const payload = validate(updateSchema, req.body);
  res.json({ campaign: service.updateCampaign(Number(req.params.id), req.user.id, payload) });
}));

campaignsRouter.delete('/:id', asyncHandler((req, res) => {
  res.json(service.deleteCampaign(Number(req.params.id), req.user.id));
}));

campaignsRouter.post('/:id/invite-code', asyncHandler((req, res) => {
  res.json({ campaign: service.regenerateInviteCode(Number(req.params.id), req.user.id) });
}));

campaignsRouter.delete('/:id/members/:memberId', asyncHandler((req, res) => {
  res.json(service.removeMember(Number(req.params.id), req.user.id, Number(req.params.memberId)));
}));

/** Escudo do Mestre (painel do DM). */
campaignsRouter.get('/:id/shield', asyncHandler((req, res) => {
  res.json(service.masterShield(Number(req.params.id), req.user.id));
}));

campaignsRouter.patch('/:id/party/:characterId/hp', asyncHandler((req, res) => {
  const payload = validate(hpSchema, req.body);
  res.json(service.masterAdjustHp(Number(req.params.id), req.user.id, Number(req.params.characterId), payload));
}));
