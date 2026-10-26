/** Hash de senha, emissão/verificação de JWT e geração de códigos de convite. */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from './httpError.js';

const SALT_ROUNDS = 10;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    return { id: Number(payload.sub), email: payload.email, name: payload.name };
  } catch {
    throw HttpError.unauthorized('Sessão expirada ou token inválido.');
  }
}

/** Código de convite de campanha: 8 caracteres em maiúsculas, sem ambíguos. */
export function generateInviteCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let index = 0; index < length; index += 1) {
    code += alphabet[bytes[index] % alphabet.length];
  }
  return code;
}
