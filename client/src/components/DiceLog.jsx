/**
 * Log de rolagens no canto da tela — compartilhado com a campanha em tempo real.
 * Também serve de rolagem livre ("2d6+3", "4d6").
 */
import { useEffect, useRef, useState } from 'react';
import { describeRoll } from '@shared/rules/index.js';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { classNames } from '../lib/format.js';
import { Button, Select, Spinner } from './ui.jsx';

function ResultLine({ entry }) {
  const result = entry.result ?? {};
  const isD20 = result.kind === 'd20';
  const modeLabel = result.mode === 'advantage'
    ? 'vantagem'
    : result.mode === 'disadvantage'
      ? 'desvantagem'
      : null;

  return (
    <li className="animate-roll-in rounded-lg border border-ink-700/70 bg-ink-900/70 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium text-slate-300">{entry.label || 'Rolagem livre'}</span>
        <span
          className={classNames(
            'font-display text-lg leading-none',
            result.isCritical ? 'text-neon-300' : result.isCriticalFail ? 'text-ember' : 'text-arcane-200',
          )}
        >
          {result.total}
        </span>
      </div>

      {/* Uma única linha com o resultado final (ex.: "1d20 (14) + 5 = 19"). */}
      <p className="mt-1 font-mono text-[11px] text-slate-300">{describeRoll(result) || entry.expression}</p>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
        <span className="font-mono text-slate-500">{entry.expression}</span>
        {isD20 && modeLabel ? (
          <span className="text-arcane-300">
            {modeLabel}
            {result.discarded != null ? ` · descarta ${result.discarded}` : ''}
          </span>
        ) : null}
        {entry.user_name ? <span className="text-slate-600">· {entry.user_name}</span> : null}
      </div>

      {result.isCritical ? (
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-neon-300">Acerto crítico!</p>
      ) : null}
      {result.isCriticalFail ? (
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ember">Falha crítica</p>
      ) : null}
    </li>
  );
}

export function DiceLog() {
  const { diceLog, roll, clearLog, connected, loadLog } = useRealtime();
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState('1d20');
  const [mode, setMode] = useState('normal');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const previousFirstId = useRef(null);

  // Pisca o botão quando chega uma rolagem nova.
  const firstId = diceLog[0]?.id ?? null;
  useEffect(() => {
    if (firstId && previousFirstId.current && firstId !== previousFirstId.current) setOpen(true);
    previousFirstId.current = firstId;
  }, [firstId]);

  const handleFreeRoll = async (event) => {
    event.preventDefault();
    if (!expression.trim()) return;
    setPending(true);
    setError(null);
    try {
      await roll({ expression: expression.trim(), label: 'Rolagem livre', mode });
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await loadLog().catch(() => {});
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open ? (
        <div className="panel pointer-events-auto flex w-[21rem] max-w-[calc(100vw-2rem)] flex-col animate-fade-up">
          <div className="panel-head">
            <div className="flex items-center gap-2">
              <span
                className={classNames('h-2 w-2 rounded-full', connected ? 'bg-neon-400' : 'bg-ink-500')}
                title={connected ? 'Conectado em tempo real' : 'Desconectado'}
              />
              <h2 className="section-title">Rolagens</h2>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="btn-ghost btn-xs" onClick={clearLog} title="Limpar o log">
                Limpar
              </button>
              <button type="button" className="btn-ghost btn-xs" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>
          </div>

          <form onSubmit={handleFreeRoll} className="flex items-center gap-1.5 border-b border-ink-700/70 px-3 py-2">
            <input
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              placeholder="2d6+3"
              aria-label="Expressão de dados"
              className="input flex-1 px-2 py-1.5 font-mono text-xs"
            />
            <Select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              aria-label="Modo de rolagem"
              className="w-auto px-2 py-1.5 text-xs"
            >
              <option value="normal">Normal</option>
              <option value="advantage">Vantagem</option>
              <option value="disadvantage">Desvantagem</option>
            </Select>
            <Button type="submit" variant="primary" size="xs" loading={pending}>
              Rolar
            </Button>
          </form>

          {error ? <p className="px-3 pt-2 text-xs text-ember">{error}</p> : null}

          <ul className="max-h-72 space-y-1.5 overflow-y-auto px-3 py-3">
            {diceLog.length === 0 ? (
              <li className="py-6 text-center text-xs text-slate-500">
                Nenhuma rolagem ainda. Clique em um modificador da ficha.
              </li>
            ) : (
              diceLog.map((entry) => <ResultLine key={entry.id} entry={entry} />)
            )}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggle}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-arcane-500/40 bg-ink-850/95 px-4 py-2.5 text-sm font-medium text-slate-200 shadow-glow backdrop-blur transition-colors hover:border-arcane-400"
      >
        <span aria-hidden className="text-arcane-300">⬢</span>
        Rolagens
        {pending ? <Spinner className="h-3 w-3" /> : null}
        {diceLog.length > 0 ? (
          <span className="rounded-full bg-arcane-600 px-1.5 py-0.5 text-[11px] leading-none text-white">
            {diceLog.length}
          </span>
        ) : null}
      </button>
    </div>
  );
}
