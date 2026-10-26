/** Validação de payloads com Zod, devolvendo 400 com detalhes legíveis. */
import { HttpError } from './httpError.js';

export function validate(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(raiz)',
      message: issue.message,
    }));
    throw HttpError.badRequest('Dados inválidos.', details);
  }
  return result.data;
}
