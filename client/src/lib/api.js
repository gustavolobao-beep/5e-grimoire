/**
 * Cliente HTTP fino sobre a API do Grimório 5e.
 * Guarda o JWT em memória + localStorage e injeta no header Authorization.
 */
const BASE = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'grimorio5e.token';

let authToken = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

export const getToken = () => authToken;

export function setToken(token) {
  authToken = token ?? null;
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(method, path, { body, query, signal } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error?.message ?? `Erro ${response.status} ao chamar ${method} ${path}.`,
      response.status,
      data?.error?.details,
    );
  }

  return data;
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  del: (path, options) => request('DELETE', path, options),
};
