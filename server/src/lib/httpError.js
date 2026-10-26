/** Erro HTTP com status e payload padronizados para o frontend. */
export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message = 'Requisição inválida.', details) {
    return new HttpError(400, message, details);
  }

  static unauthorized(message = 'Autenticação necessária.') {
    return new HttpError(401, message);
  }

  static forbidden(message = 'Você não tem permissão para esta ação.') {
    return new HttpError(403, message);
  }

  static notFound(message = 'Recurso não encontrado.') {
    return new HttpError(404, message);
  }

  static conflict(message = 'Conflito de dados.', details) {
    return new HttpError(409, message, details);
  }
}

/** Envolve handlers async para que erros cheguem ao middleware de erro. */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
