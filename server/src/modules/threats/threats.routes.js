/** Rotas das ameaças: bestiário (SRD) e fichas homebrew. */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/httpError.js';
import { validate } from '../../lib/validate.js';
import { authenticate } from '../../middleware/auth.js';
import * as service from './threats.service.js';

export const threatsRouter = Router();
threatsRouter.use(authenticate);

const numberOrUndefined = (value) => (value === undefined || value === '' ? undefined : Number(value));

/** Statblock no formato do SRD (aceito para ameaças homebrew). */
const statblockSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  size: z.string().trim().max(40).optional(),
  type: z.string().trim().max(60).optional(),
  alignment: z.string().trim().max(60).optional(),
  armor_class: z.array(z.object({ type: z.string().optional(), value: z.number() })).optional(),
  hit_points: z.number().int().optional(),
  hit_dice: z.string().max(40).optional(),
  speed: z.record(z.string()).optional(),
  strength: z.number().int().optional(),
  dexterity: z.number().int().optional(),
  constitution: z.number().int().optional(),
  intelligence: z.number().int().optional(),
  wisdom: z.number().int().optional(),
  charisma: z.number().int().optional(),
  challenge_rating: z.number().optional(),
  xp: z.number().int().optional(),
  actions: z.array(z.record(z.any())).optional(),
  legendary_actions: z.array(z.record(z.any())).optional(),
  reactions: z.array(z.record(z.any())).optional(),
  special_abilities: z.array(z.record(z.any())).optional(),
}).passthrough();

const createSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da ameaça.').max(120),
  payload: statblockSchema,
  source: z.enum(['srd', 'custom']).optional(),
  sourceIndex: z.string().trim().max(120).nullable().optional(),
  isHomebrew: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  payload: statblockSchema.optional(),
  isHomebrew: z.boolean().optional(),
});

const hpSchema = z.object({
  delta: z.number().int().min(-9999).max(9999).optional(),
  current: z.number().int().min(0).max(99999).optional(),
  temp: z.number().int().min(0).max(9999).optional(),
}).refine((value) => value.delta !== undefined || value.current !== undefined || value.temp !== undefined, {
  message: 'Informe "delta", "current" ou "temp".',
});

// --- Bestiário do SRD -------------------------------------------------------
threatsRouter.get('/bestiary', asyncHandler((req, res) => {
  res.json(service.searchBestiary({
    search: req.query.search,
    type: req.query.type,
    size: req.query.size,
    crMin: numberOrUndefined(req.query.crMin),
    crMax: numberOrUndefined(req.query.crMax),
    limit: numberOrUndefined(req.query.limit) ?? 60,
    offset: numberOrUndefined(req.query.offset) ?? 0,
  }));
}));

threatsRouter.get('/bestiary/meta', (_req, res) => {
  res.json(service.bestiaryMeta());
});

threatsRouter.post('/from-srd/:index', asyncHandler((req, res) => {
  res.status(201).json(service.importFromSrd(req.user.id, req.params.index));
}));

threatsRouter.get('/bestiary/:index', asyncHandler((req, res) => {
  res.json(service.getBestiaryMonster(req.params.index));
}));

// --- Ameaças do Mestre (homebrew) ------------------------------------------
threatsRouter.get('/', asyncHandler((req, res) => {
  res.json(service.listHomebrew(req.user.id, {
    search: req.query.search,
    limit: numberOrUndefined(req.query.limit) ?? 100,
    offset: numberOrUndefined(req.query.offset) ?? 0,
  }));
}));

threatsRouter.post('/', asyncHandler((req, res) => {
  const payload = validate(createSchema, req.body);
  res.status(201).json(service.createThreat(req.user.id, payload));
}));

threatsRouter.get('/:id', asyncHandler((req, res) => {
  res.json(service.getThreat(Number(req.params.id), req.user.id));
}));

threatsRouter.put('/:id', asyncHandler((req, res) => {
  const payload = validate(updateSchema, req.body);
  res.json(service.updateThreat(Number(req.params.id), req.user.id, payload));
}));

threatsRouter.patch('/:id/hp', asyncHandler((req, res) => {
  const payload = validate(hpSchema, req.body);
  res.json(service.patchThreatHp(Number(req.params.id), req.user.id, payload));
}));

threatsRouter.delete('/:id', asyncHandler((req, res) => {
  res.json(service.deleteThreat(Number(req.params.id), req.user.id));
}));
