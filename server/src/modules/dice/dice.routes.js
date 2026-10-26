/** Rotas do rolador de dados e do log de rolagens. */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/httpError.js';
import { validate } from '../../lib/validate.js';
import { authenticate } from '../../middleware/auth.js';
import * as service from './dice.service.js';

export const diceRouter = Router();
diceRouter.use(authenticate);

const rollSchema = z.object({
  expression: z.string().trim().min(1).max(80).optional(),
  characterId: z.number().int().positive().nullable().optional(),
  campaignId: z.number().int().positive().nullable().optional(),
  label: z.string().trim().max(120).optional(),
  mode: z.enum(['normal', 'advantage', 'disadvantage']).optional(),
  modifier: z.number().int().min(-50).max(50).optional(),
  visibility: z.enum(['public', 'dm', 'private']).optional(),
  target: z.object({
    kind: z.enum(['ability', 'save', 'skill', 'attack', 'damage', 'initiative', 'death-save', 'spell-attack']),
    key: z.string().trim().max(60).optional(),
    label: z.string().trim().max(120).optional(),
  }).optional(),
}).refine((value) => value.expression || (value.characterId && value.target), {
  message: 'Envie "expression" ou "characterId" + "target".',
});

diceRouter.post('/roll', asyncHandler((req, res) => {
  const payload = validate(rollSchema, req.body);
  res.status(201).json({ entry: service.performRoll({ user: req.user, payload }) });
}));

diceRouter.get('/log', asyncHandler((req, res) => {
  const campaignId = req.query.campaignId ? Number(req.query.campaignId) : null;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  res.json({ items: service.listLog({ campaignId, userId: req.user.id, limit }) });
}));

diceRouter.delete('/log', asyncHandler((req, res) => {
  const campaignId = req.query.campaignId ? Number(req.query.campaignId) : null;
  res.json(service.clearLog({ campaignId, userId: req.user.id }));
}));
