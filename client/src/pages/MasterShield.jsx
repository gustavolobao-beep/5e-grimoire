/**
 * Escudo do Mestre: painel em tempo real com a mesa inteira.
 * Mostra PV/CA/Percepção Passiva, condições, resistências, perícias e ataques
 * já roláveis — tudo sem abrir a ficha de cada jogador.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RollButton } from '../components/RollButton.jsx';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  EmptyState,
  HealthBar,
  Input,
  LoadingScreen,
  Panel,
  PanelHeader,
} from '../components/ui.jsx';
import { useRealtime, useRealtimeEvent } from '../context/RealtimeContext.jsx';
import { api } from '../lib/api.js';
import { ABILITY_ABBR, formatModifier } from '../lib/format.js';

export default function MasterShield() {
  const { id } = useParams();
  const { setCampaignId, loadLog, connected } = useRealtime();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pulse, setPulse] = useState(null);
  const reloadTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get(`/campaigns/${id}/shield`));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  useEffect(() => {
    setCampaignId(id);
    loadLog({ campaignId: id }).catch(() => {});
    return () => setCampaignId(null);
  }, [id, setCampaignId, loadLog]);

  const scheduleReload = useCallback((characterId) => {
    if (characterId) {
      setPulse(String(characterId));
      setTimeout(() => setPulse(null), 1200);
    }
    clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => load().catch(() => {}), 350);
  }, [load]);

  useRealtimeEvent('character:updated', (payload) => scheduleReload(payload?.characterId));
  useRealtimeEvent('party:updated', () => scheduleReload());

  const adjustHp = useCallback(async (characterId, payload) => {
    try {
      const result = await api.patch(`/campaigns/${id}/party/${characterId}/hp`, payload);
      setPulse(String(characterId));
      setTimeout(() => setPulse(null), 1200);
      setData((current) => current && {
        ...current,
        party: current.party.map((entry) => (
          entry.characterId === characterId && result.summary
            ? { ...entry, summary: { ...entry.summary, ...result.summary } }
            : entry
        )),
      });
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  if (!data && !error) return <LoadingScreen />;
  if (!data) return <Alert className="mt-4">{error}</Alert>;

  const { campaign, party } = data;

  return (
    <div className="space-y-5">
      <nav className="text-xs text-slate-500">
        <Link to="/campanhas" className="hover:text-arcane-300">Campanhas</Link>
        <span className="px-1.5">/</span>
        <Link to={`/campanhas/${id}`} className="hover:text-arcane-300">{campaign.name}</Link>
        <span className="px-1.5">/</span>
        <span className="text-slate-400">Escudo do Mestre</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-100">Escudo do Mestre</h1>
          <p className="text-sm text-slate-400">
            {campaign.name} · {party.filter((entry) => entry.summary).length} personagens vinculados
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-neon-400' : 'bg-ink-600'}`} />
          {connected ? 'Sincronização ativa' : 'Reconectando…'}
        </div>
      </header>

      <Alert>{error}</Alert>

      {party.length === 0 ? (
        <EmptyState
          icon="☰"
          title="Nenhum jogador ainda"
          description="Compartilhe o código de convite no detalhe da campanha."
          action={<Link to={`/campanhas/${id}`} className="btn-primary">Ir para o convite</Link>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {party.map((entry) => (
            <PartyCard
              key={entry.memberId}
              entry={entry}
              highlighted={pulse === String(entry.characterId)}
              onAdjustHp={(payload) => adjustHp(entry.characterId, payload)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PartyCard({ entry, highlighted, onAdjustHp }) {
  const summary = entry.summary;
  const [delta, setDelta] = useState('5');

  if (!summary) {
    return (
      <Panel className={highlighted ? 'border-arcane-500/70 shadow-glow' : undefined}>
        <PanelHeader title={entry.userName ?? 'Jogador'} subtitle="Sem ficha vinculada" />
        <div className="p-4 text-sm text-slate-500">Este jogador ainda não escolheu um personagem.</div>
      </Panel>
    );
  }

  const conditions = entry.conditions ?? [];

  return (
    <Panel className={`transition-all ${highlighted ? 'border-arcane-500/70 shadow-glow' : ''}`}>
      <div className="panel-head">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={summary.name} />
          <div className="min-w-0">
            <h2 className="truncate font-display text-base text-slate-100">{summary.name}</h2>
            <p className="truncate text-xs text-slate-400">
              {entry.userName} · {summary.classes} (nível {summary.level})
            </p>
          </div>
        </div>
        {summary.isUnconscious ? <Badge tone="ember">Inconsciente</Badge> : null}
      </div>

      <div className="space-y-4 p-4">
        {/* PV + ajuste rápido pelo Mestre */}
        <div className="space-y-2 rounded-xl border border-ink-700/70 bg-ink-900/50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-widest text-slate-500">Pontos de Vida</span>
            <span className="font-display text-lg text-slate-100">
              {summary.hpCurrent}
              <span className="text-sm text-slate-500">/{summary.hpMax}</span>
              {summary.hpTemp > 0 ? <span className="text-sm text-neon-300"> +{summary.hpTemp}</span> : null}
            </span>
          </div>
          <HealthBar current={summary.hpCurrent} max={summary.hpMax} temp={summary.hpTemp} />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="danger" size="xs" onClick={() => onAdjustHp({ delta: -Number(delta) || 0 })}>
              −{delta}
            </Button>
            <Button variant="ghost" size="xs" onClick={() => onAdjustHp({ delta: -1 })}>−1</Button>
            <Button variant="ghost" size="xs" onClick={() => onAdjustHp({ delta: 1 })}>+1</Button>
            <Button variant="neon" size="xs" onClick={() => onAdjustHp({ delta: Number(delta) || 0 })}>
              +{delta}
            </Button>
            <Input
              value={delta}
              onChange={(e) => setDelta(e.target.value.replace(/[^\d]/g, ''))}
              className="w-14 px-2 py-1 text-center text-xs"
              aria-label="Quantidade de PV"
            />
            <Button variant="ghost" size="xs" onClick={() => onAdjustHp({ current: summary.hpMax, temp: 0 })}>
              Curar tudo
            </Button>
          </div>
        </div>

        {/* Dados rápidos */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <QuickStat label="CA" value={summary.armorClass} />
          <QuickStat label="P. Passiva" value={summary.passivePerception} />
          <QuickStat label="Iniciativa" value={formatModifier(summary.initiative)} />
        </div>

        {conditions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {conditions.map((condition) => (
              <Badge key={condition} tone="ember">{condition}</Badge>
            ))}
          </div>
        ) : null}

        {/* Ataques roláveis */}
        {entry.attacks.length > 0 ? (
          <div>
            <p className="section-title mb-2 text-xs">Ataques</p>
            <div className="space-y-1.5">
              {entry.attacks.map((attack) => (
                <div key={attack.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-1.5">
                  <span className="min-w-0 truncate text-sm text-slate-300">{attack.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <RollButton
                      variant="ghost"
                      size="xs"
                      expression={attack.attackExpression}
                      label={`Ataque: ${attack.name}`}
                      title={`Rolar ${attack.attackExpression}`}
                    >
                      {attack.attackExpression}
                    </RollButton>
                    <RollButton
                      variant="ghost"
                      size="xs"
                      expression={attack.damageExpression}
                      label={`Dano: ${attack.name}`}
                      title={`Rolar ${attack.damageExpression}`}
                    >
                      {attack.damageExpression}
                    </RollButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Resistências */}
        {entry.savingThrows.length > 0 ? (
          <div>
            <p className="section-title mb-2 text-xs">Resistências</p>
            <div className="grid grid-cols-3 gap-1.5">
              {entry.savingThrows.map((save) => (
                <RollButton
                  key={save.key}
                  variant="ghost"
                  size="xs"
                  expression={`1d20${save.total >= 0 ? '+' : ''}${save.total}`}
                  label={`Resistência de ${ABILITY_ABBR[save.key] ?? save.key}`}
                  className="justify-center"
                >
                  {ABILITY_ABBR[save.key] ?? save.key} {formatModifier(save.total)}
                </RollButton>
              ))}
            </div>
          </div>
        ) : null}

        {/* Perícias com proficiência */}
        {entry.skills.length > 0 ? (
          <div>
            <p className="section-title mb-2 text-xs">Perícias</p>
            <div className="flex flex-wrap gap-1.5">
              {entry.skills.map((skill) => (
                <RollButton
                  key={skill.key}
                  variant="ghost"
                  size="xs"
                  expression={`1d20${skill.total >= 0 ? '+' : ''}${skill.total}`}
                  label={skill.name}
                >
                  {skill.name} {formatModifier(skill.total)}
                </RollButton>
              ))}
            </div>
          </div>
        ) : null}

        {/* Espaços de magia */}
        {entry.spellSlots && hasSlots(entry.spellSlots) ? (
          <div>
            <p className="section-title mb-2 text-xs">
              Magias {entry.spellSlots.saveDc ? `· CD ${entry.spellSlots.saveDc}` : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(entry.spellSlots.slots ?? {}).map(([level, total]) => {
                const used = entry.spellSlots.used?.[level] ?? 0;
                return (
                  <span key={level} className="chip">
                    {level}º {total - used}/{total}
                  </span>
                );
              })}
              {entry.spellSlots.pact ? (
                <span className="chip border-arcane-500/40 bg-arcane-500/10 text-arcane-200">
                  Pacto {entry.spellSlots.pact.count - (entry.spellSlots.pactUsed?.count ?? 0)}/{entry.spellSlots.pact.count}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {entry.warnings?.length > 0 ? (
          <div className="space-y-1">
            {entry.warnings.map((warning) => (
              <p key={warning} className="text-[11px] text-gold">⚠ {warning}</p>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function hasSlots(spellSlots) {
  const hasStandard = Object.values(spellSlots.slots ?? {}).some((value) => value > 0);
  return hasStandard || Boolean(spellSlots.pact);
}

function QuickStat({ label, value }) {
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-900/60 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-display text-sm text-slate-100">{value}</p>
    </div>
  );
}
