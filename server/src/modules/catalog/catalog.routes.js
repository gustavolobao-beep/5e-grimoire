/**
 * Endpoints de leitura do catálogo 5e (classes, magias, itens, raças...).
 * Todas as rotas exigem autenticação — o catálogo é o combustível das fichas.
 */
import { Router } from 'express';
import { asyncHandler } from '../../lib/httpError.js';
import { HttpError } from '../../lib/httpError.js';
import { authenticate } from '../../middleware/auth.js';
import * as catalog from './catalog.repository.js';

export const catalogRouter = Router();
catalogRouter.use(authenticate);

const numberOrUndefined = (value) => (value === undefined || value === '' ? undefined : Number(value));

catalogRouter.get('/meta', (_req, res) => {
  res.json({ meta: catalog.catalogMeta() });
});

catalogRouter.get('/classes', (_req, res) => {
  res.json({ items: catalog.listClasses() });
});

catalogRouter.get('/classes/:index', asyncHandler((req, res) => {
  const klass = catalog.findClass(req.params.index);
  if (!klass) throw HttpError.notFound('Classe não encontrada.');
  res.json({
    class: klass,
    subclasses: catalog.listSubclasses(req.params.index),
    levels: catalog.listClassLevels(req.params.index),
    features: catalog.listClassFeatures(req.params.index),
  });
}));

catalogRouter.get('/subclasses', (req, res) => {
  res.json({ items: catalog.listSubclasses(req.query.class) });
});

catalogRouter.get('/spells', (req, res) => {
  const { search, level, class: classIndex, school } = req.query;
  const result = catalog.listSpells({
    search,
    level: numberOrUndefined(level),
    classIndex,
    school,
    ritual: req.query.ritual === undefined ? undefined : req.query.ritual === 'true',
    concentration: req.query.concentration === undefined ? undefined : req.query.concentration === 'true',
    limit: numberOrUndefined(req.query.limit) ?? 60,
    offset: numberOrUndefined(req.query.offset) ?? 0,
  });
  res.json(result);
});

catalogRouter.get('/spells/:index', asyncHandler((req, res) => {
  const spell = catalog.findSpell(req.params.index);
  if (!spell) throw HttpError.notFound('Magia não encontrada.');
  res.json({ spell });
}));

catalogRouter.get('/equipment', (req, res) => {
  const { search, kind, category } = req.query;
  const result = catalog.listEquipment({
    search,
    kind,
    category,
    limit: numberOrUndefined(req.query.limit) ?? 100,
    offset: numberOrUndefined(req.query.offset) ?? 0,
  });
  res.json(result);
});

catalogRouter.get('/equipment/:index', asyncHandler((req, res) => {
  const item = catalog.findEquipment(req.params.index);
  if (!item) throw HttpError.notFound('Item não encontrado.');
  res.json({ item });
}));

catalogRouter.get('/magic-items', (req, res) => {
  const result = catalog.listMagicItems({
    search: req.query.search,
    rarity: req.query.rarity,
    limit: numberOrUndefined(req.query.limit) ?? 100,
    offset: numberOrUndefined(req.query.offset) ?? 0,
  });
  res.json(result);
});

catalogRouter.get('/magic-items/:index', asyncHandler((req, res) => {
  const item = catalog.findMagicItem(req.params.index);
  if (!item) throw HttpError.notFound('Item mágico não encontrado.');
  res.json({ item });
}));

for (const collection of ['races', 'backgrounds', 'skills', 'proficiencies']) {
  catalogRouter.get(`/${collection}`, asyncHandler((req, res) => {
    const items = catalog.listSimple(collection);
    if (!items) throw HttpError.notFound('Coleção inexistente.');
    res.json({ items });
  }));
}

catalogRouter.get('/reference/:collection', asyncHandler((req, res) => {
  const items = catalog.listReference(req.params.collection);
  res.json({ collection: req.params.collection, items });
}));
