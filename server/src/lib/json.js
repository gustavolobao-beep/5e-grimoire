/** Helpers de serialização para colunas que guardam JSON em TEXT. */

export function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toJson(value) {
  return JSON.stringify(value ?? null);
}

export function parseJsonField(row, key, fallback) {
  if (!row) return row;
  return parseJson(row[key], fallback);
}
