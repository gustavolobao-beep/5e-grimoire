/** Bestiário: busca de ameaças no SRD + atalho para as ameaças do Mestre. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  EmptyState,
  Input,
  Panel,
  PanelHeader,
  Select,
  Spinner,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { pluralize } from '../lib/format.js';

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const SIZE_LABEL = {
  Tiny: 'Minúsculo',
  Small: 'Pequeno',
  Medium: 'Médio',
  Large: 'Grande',
  Huge: 'Enorme',
  Gargantuan: 'Colossal',
};

export default function Bestiary() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: params.get('busca') ?? '',
    type: params.get('tipo') ?? '',
    size: params.get('tamanho') ?? '',
    crMin: params.get('crMin') ?? '',
    crMax: params.get('crMax') ?? '',
  });
  const [result, setResult] = useState(null);
  const [types, setTypes] = useState([]);
  const [homebrew, setHomebrew] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/threats/bestiary/meta').then((data) => setTypes(data.types ?? [])).catch(() => setTypes([]));
    api.get('/threats').then((data) => setHomebrew(data.items ?? [])).catch(() => setHomebrew([]));
  }, []);

  const load = useCallback(async (current) => {
    setLoading(true);
    try {
      const query = Object.fromEntries(
        Object.entries(current).filter(([, value]) => value !== '' && value !== undefined),
      );
      const data = await api.get('/threats/bestiary', { query: { ...query, limit: 60 } });
      setResult(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Busca com pequeno atraso para não disparar a cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  // Mantém a URL compartilhável com os filtros atuais.
  useEffect(() => {
    const next = {};
    if (filters.search) next.busca = filters.search;
    if (filters.type) next.tipo = filters.type;
    if (filters.size) next.tamanho = filters.size;
    if (filters.crMin) next.crMin = filters.crMin;
    if (filters.crMax) next.crMax = filters.crMax;
    setParams(next, { replace: true });
  }, [filters, setParams]);

  const update = (patch) => setFilters((current) => ({ ...current, ...patch }));
  const items = result?.items ?? [];

  const typeOptions = useMemo(() => types.map((type) => ({ value: type, label: capitalize(type) })), [types]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-100">Ameaças</h1>
          <p className="text-sm text-slate-400">Bestiário do SRD — abra uma ficha para rolar ataques e resistências.</p>
        </div>
        <Link to="/homebrew" className="btn-ghost">Minhas ameaças ({homebrew.length})</Link>
      </header>

      <Alert>{error}</Alert>

      <Panel>
        <PanelHeader
          title="Buscar no bestiário"
          subtitle={result ? pluralize(result.total, 'ameaça encontrada', 'ameaças encontradas') : 'Carregando…'}
          action={loading ? <Spinner /> : null}
        />
        <div className="grid gap-3 border-b border-ink-700/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Nome do monstro…"
            className="lg:col-span-2"
          />
          <Select value={filters.type} onChange={(e) => update({ type: e.target.value })}>
            <option value="">Todos os tipos</option>
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Select value={filters.size} onChange={(e) => update({ size: e.target.value })}>
            <option value="">Todos os tamanhos</option>
            {SIZES.map((size) => (
              <option key={size} value={size}>{SIZE_LABEL[size]}</option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <Input
              value={filters.crMin}
              onChange={(e) => update({ crMin: e.target.value.replace(/[^\d./]/g, '') })}
              placeholder="CR mín."
              className="text-center"
              aria-label="Nível de desafio mínimo"
            />
            <span className="text-slate-500">–</span>
            <Input
              value={filters.crMax}
              onChange={(e) => update({ crMax: e.target.value.replace(/[^\d./]/g, '') })}
              placeholder="CR máx."
              className="text-center"
              aria-label="Nível de desafio máximo"
            />
          </div>
        </div>

        <div className="p-4">
          {!result ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : items.length === 0 ? (
            <EmptyState icon="☠" title="Nada encontrado" description="Ajuste a busca ou os filtros de CR e tipo." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((monster) => (
                <MonsterCard key={monster.index} monster={monster} />
              ))}
            </div>
          )}
        </div>
      </Panel>

      {homebrew.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Suas ameaças"
            subtitle="Fichas criadas ou importadas por você"
            action={<Link to="/homebrew" className="btn-ghost btn-xs">Gerenciar</Link>}
          />
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {homebrew.slice(0, 6).map((threat) => (
              <Link
                key={threat.id}
                to={`/ameacas/${threat.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-ink-700/70 bg-ink-900/40 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-arcane-500/50"
              >
                <span className="truncate">{threat.name}</span>
                <Badge tone={threat.source === 'srd' ? 'default' : 'arcane'}>
                  {threat.source === 'srd' ? 'SRD' : 'Homebrew'}
                </Badge>
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function MonsterCard({ monster }) {
  return (
    <Link
      to={`/ameacas/bestiario/${monster.index}`}
      className="panel group flex flex-col gap-2 p-3 transition-all hover:border-arcane-500/60 hover:shadow-glow"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm text-slate-100 group-hover:text-white">{monster.name}</h3>
        <Badge tone="gold">CR {monster.challengeRating}</Badge>
      </div>
      <p className="text-xs capitalize text-slate-400">
        {SIZE_LABEL[monster.size] ?? monster.size} · {monster.type}
      </p>
      <div className="mt-auto flex gap-3 pt-1 text-xs text-slate-500">
        <span>PV {monster.hitPoints ?? '—'}</span>
        <span>CA {monster.armorClass ?? '—'}</span>
        {monster.xp ? <span>{monster.xp} XP</span> : null}
      </div>
    </Link>
  );
}

function capitalize(value) {
  const text = String(value ?? '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
