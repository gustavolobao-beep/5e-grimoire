/**
 * Tudo o que pode ser rolado. O botão envia a rolagem para a API, que resolve o
 * modificador (a partir da ficha) e transmite o resultado em tempo real.
 */
import { useCallback, useRef, useState } from 'react';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { classNames } from '../lib/format.js';
import { Spinner } from './ui.jsx';

/** Janela (ms) em que um novo clique é tratado como repetição do anterior. */
const DOUBLE_CLICK_WINDOW = 350;

/**
 * Hook que expõe `roll` já tratando erro/carregando.
 * Uma rolagem só é disparada uma vez por clique: enquanto uma requisição está
 * em andamento — ou dentro da janela de debounce — cliques extras são ignorados.
 */
export function useRoller() {
  const { roll } = useRealtime();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const lockedRef = useRef(false);
  const lastRunRef = useRef(0);

  const run = useCallback(
    async (payload) => {
      const now = Date.now();
      if (lockedRef.current || now - lastRunRef.current < DOUBLE_CLICK_WINDOW) return null;

      lockedRef.current = true;
      lastRunRef.current = now;
      setPending(true);
      setError(null);
      try {
        return await roll(payload);
      } catch (err) {
        setError(err);
        return null;
      } finally {
        lockedRef.current = false;
        setPending(false);
      }
    },
    [roll],
  );

  return { run, pending, error };
}

/**
 * Botão de rolagem.
 * @param {object}  props
 * @param {object}  [props.target]  alvo da ficha: { kind, key, label }
 * @param {string}  [props.expression] expressão livre (ex.: "2d6+3")
 * @param {number}  [props.characterId] ficha usada para resolver o modificador
 * @param {React.ReactNode} props.children conteúdo (o rótulo clicável)
 */
export function RollButton({
  target,
  expression,
  characterId,
  label,
  mode = 'normal',
  variant = 'ghost',
  size,
  className,
  title,
  children,
  ...rest
}) {
  const { run, pending } = useRoller();

  const handleClick = async () => {
    await run({ target, expression, characterId, label, mode });
  };

  const variants = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    neon: 'btn-neon',
    plain: '',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title ?? `Rolar ${label ?? expression ?? ''}`}
      className={classNames(variants[variant] ?? variants.ghost, size === 'xs' && 'btn-xs', className)}
      {...rest}
    >
      {pending ? <Spinner className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

/** Envolve qualquer conteúdo clicável (modificador de atributo, linha de perícia…). */
export function Rollable({ target, expression, characterId, label, mode, className, title, children }) {
  const { run, pending } = useRoller();

  return (
    <button
      type="button"
      onClick={() => run({ target, expression, characterId, label, mode })}
      title={title ?? `Rolar ${label ?? ''}`}
      className={classNames('rollable w-full px-2 py-1 text-left', pending && 'opacity-60', className)}
    >
      {children}
    </button>
  );
}
