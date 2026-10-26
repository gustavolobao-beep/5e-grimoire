/** Middleware de autenticação por Bearer token (JWT). */
import { verifyToken } from '../lib/auth.js';
import { HttpError } from '../lib/httpError.js';

export function authenticate(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(HttpError.unauthorized('Informe o token de acesso (Authorization: Bearer ...).'));
  }

  try {
    req.user = verifyToken(token);
    return next();
  } catch (error) {
    return next(error);
  }
}
