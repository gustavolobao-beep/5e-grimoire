/** Tratamento centralizado de erros (404 e exceções da aplicação). */
import { HttpError } from '../lib/httpError.js';

export function notFoundHandler(req, _res, next) {
  next(HttpError.notFound(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error, _req, res, _next) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = status === 500 ? 'Erro interno no servidor.' : error.message;

  if (status === 500) {
    console.error('[erro]', error);
  }

  res.status(status).json({
    error: { message, status, details: error.details ?? undefined },
  });
}
