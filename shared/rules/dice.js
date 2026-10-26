/**
 * Parser e rolador de expressões de dados (ex.: "1d20+5", "2d6+1d4+3").
 * Puro e determinístico quando recebe um `rng` customizado (facilita testes).
 */

const EXPRESSION_RE = /[+-]?(\d*d\d+|\d+)/g;

/** Converte "2d6+3" em uma lista de termos tipados. */
export function parseExpression(expression) {
  const raw = String(expression ?? '').replace(/\s+/g, '').toLowerCase();
  if (!raw) throw new Error('Expressão de dados vazia.');

  const tokens = raw.match(EXPRESSION_RE);
  if (!tokens || tokens.join('') !== raw) {
    throw new Error(`Expressão de dados inválida: "${expression}".`);
  }

  const terms = tokens.map((token) => {
    const sign = token.startsWith('-') ? -1 : 1;
    const body = token.replace(/^[+-]/, '');

    if (body.includes('d')) {
      const [countRaw, sidesRaw] = body.split('d');
      const count = countRaw === '' ? 1 : Number(countRaw);
      const sides = Number(sidesRaw);
      if (!Number.isInteger(count) || count < 1 || count > 100) {
        throw new Error(`Quantidade de dados inválida em "${token}".`);
      }
      if (!Number.isInteger(sides) || sides < 2 || sides > 1000) {
        throw new Error(`Número de faces inválido em "${token}".`);
      }
      return { type: 'dice', sign, count, sides };
    }

    const value = Number(body);
    if (!Number.isInteger(value)) throw new Error(`Modificador inválido em "${token}".`);
    return { type: 'modifier', sign, value };
  });

  return { expression: String(expression), terms };
}

/** Rola a expressão e devolve total + detalhamento dado a dado. */
export function rollExpression(expression, { rng = Math.random } = {}) {
  const { terms } = parseExpression(expression);
  const detail = [];
  let total = 0;

  for (const term of terms) {
    if (term.type === 'modifier') {
      total += term.sign * term.value;
      detail.push({ type: 'modifier', sign: term.sign, value: term.value, subtotal: term.sign * term.value });
      continue;
    }

    const values = Array.from({ length: term.count }, () => Math.floor(rng() * term.sides) + 1);
    const subtotal = values.reduce((sum, value) => sum + value, 0);
    total += term.sign * subtotal;
    detail.push({ type: 'dice', sign: term.sign, count: term.count, sides: term.sides, values, subtotal });
  }

  return { expression: String(expression), total, detail };
}

/**
 * Rola 1d20 com modificador e modo (vantagem/desvantagem).
 * Usado por atributos, perícias, testes de resistência e ataques.
 */
export function rollD20({
  modifier = 0,
  mode = 'normal',
  label = '',
  rng = Math.random,
} = {}) {
  const first = Math.floor(rng() * 20) + 1;

  // Sem vantagem/desvantagem rolamos UM único d20 (a dupla rolagem só existe
  // quando o jogador escolhe explicitamente um dos dois modos).
  let kept = first;
  let discarded = null;
  let dice = [first];

  if (mode === 'advantage' || mode === 'disadvantage') {
    const second = Math.floor(rng() * 20) + 1;
    dice = [first, second];
    if (mode === 'advantage') {
      kept = Math.max(first, second);
      discarded = Math.min(first, second);
    } else {
      kept = Math.min(first, second);
      discarded = Math.max(first, second);
    }
  }

  const total = kept + (Number(modifier) || 0);

  return {
    kind: 'd20',
    label,
    mode,
    dice,
    kept,
    discarded,
    modifier: Number(modifier) || 0,
    total,
    isCritical: kept === 20,
    isCriticalFail: kept === 1,
  };
}

/**
 * Formata o resultado para o log em uma única linha legível,
 * ex.: "1d20 (14) + 5 = 19" ou, com vantagem, "1d20 (14, 7 → 14) + 5 = 19".
 */
export function describeRoll(result) {
  if (!result) return '';

  if (result.kind === 'd20') {
    const hasSecond = result.discarded !== null && result.discarded !== undefined;
    const dicePart = hasSecond
      ? `1d20 (${(result.dice ?? []).join(', ')} → ${result.kept})`
      : `1d20 (${result.kept})`;
    const modifier = Number(result.modifier) || 0;
    const modPart = modifier === 0 ? '' : modifier > 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`;
    return `${dicePart} ${modPart} = ${result.total}`.replace(/\s+/g, ' ').trim();
  }

  const terms = (result.detail ?? []).map((term) => {
    if (term.type === 'dice') {
      const sign = term.sign < 0 ? '- ' : '';
      return `${sign}${term.count}d${term.sides} [${(term.values ?? []).join(', ')}]`;
    }
    return term.sign < 0 ? `- ${term.value}` : `+ ${term.value}`;
  });

  return `${terms.join(' ')} = ${result.total}`.trim();
}
