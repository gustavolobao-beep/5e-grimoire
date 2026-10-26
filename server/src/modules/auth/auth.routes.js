/** Módulo de autenticação: registro, login e perfil do usuário. */
import { Router } from 'express';
import { z } from 'zod';
import { get, run } from '../../db/connection.js';
import { generateInviteCode, hashPassword, signToken, verifyPassword } from '../../lib/auth.js';
import { HttpError, asyncHandler } from '../../lib/httpError.js';
import { validate } from '../../lib/validate.js';
import { authenticate } from '../../middleware/auth.js';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe ao menos 2 caracteres.').max(80),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(6, 'A senha precisa de ao menos 6 caracteres.').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

authRouter.post('/register', asyncHandler(async (req, res) => {
  const payload = validate(registerSchema, req.body);

  const existing = get('SELECT id FROM users WHERE email = ?', [payload.email]);
  if (existing) throw HttpError.conflict('Este e-mail já está cadastrado.');

  const passwordHash = await hashPassword(payload.password);
  const result = run(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [payload.name, payload.email, passwordHash],
  );

  const user = get('SELECT id, name, email, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const payload = validate(loginSchema, req.body);

  const user = get('SELECT * FROM users WHERE email = ?', [payload.email]);
  if (!user) throw HttpError.unauthorized('E-mail ou senha incorretos.');

  const ok = await verifyPassword(payload.password, user.password_hash);
  if (!ok) throw HttpError.unauthorized('E-mail ou senha incorretos.');

  res.json({ token: signToken(user), user: publicUser(user) });
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) throw HttpError.notFound('Usuário não encontrado.');
  res.json({ user: publicUser(user) });
}));

/** Gera um novo código de convite avulso (útil para testes manuais). */
authRouter.get('/invite-code', authenticate, (_req, res) => {
  res.json({ inviteCode: generateInviteCode() });
});
