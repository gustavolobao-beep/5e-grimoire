/** Agregador das rotas da API do Grimório 5e. */
import { Router } from 'express';
import { catalogMeta } from './modules/catalog/catalog.repository.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { campaignsRouter } from './modules/campaigns/campaigns.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { charactersRouter } from './modules/characters/characters.routes.js';
import { diceRouter } from './modules/dice/dice.routes.js';
import { threatsRouter } from './modules/threats/threats.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'grimorio-5e-api', catalog: catalogMeta() });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/characters', charactersRouter);
apiRouter.use('/campaigns', campaignsRouter);
apiRouter.use('/threats', threatsRouter);
apiRouter.use('/catalog', catalogRouter);
apiRouter.use('/dice', diceRouter);
