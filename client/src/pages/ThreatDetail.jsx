/**
 * Ficha de ameaça (monstro): statblock completo com botões de rolagem para
 * ataques, dano, resistências e perícias — direto da interface.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RollButton } from '../components/RollButton.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  LoadingScreen,
  Panel,
  PanelHeader,
  Spinner,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { ABILITY_ABBR, ABILITY_KEYS, ABILITY_LABELS, formatModifier } from '../lib/format.js';

export default function ThreatDetail() {
  const { index, id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const path = index ? `/threats/bestiary/${index}` : `/threats/${id}`;
      setData(await api.get(path));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [index, id]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  if (!data && !error) return <LoadingScreen />;
  if (!data) return <Alert className="mt-4">{error}</Alert>;

  const { statblock, profile } = data;
  const isHomebrew = Boolean(data.id);

  const addToBestiary = async () => {
    setBusy(true);
    try {
      const created = await api.post(`/threats/from-srd/${statblock.index}`);
      navigate(`/ameacas/${created.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const adjustHp = async (payload) => {
    if (!data.id) return;
    try {
      setData(await api.patch(`/threats/${data.id}/hp`, payload));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <nav className="text-xs text-slate-500">
        <Link to={isHomebrew ? '/homebrew' : '/ameacas'} className="hover:text-arcane-300">
          {isHomebrew ? 'Homebrew' : 'Ameaças'}
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-slate-400">{statblock.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-100">{statblock.name}</h1>
          <p className="text-sm capitalize text-slate-400">
            {statblock.size} · {statblock.type}
            {statblock.alignment ? ` · ${statblock.alignment}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">ND {profile.challengeRating}</Badge>
          {profile.xp ? <Badge>{profile.xp} XP</Badge> : null}
          {isHomebrew ? (
            <>
              <Badge tone={data.source === 'srd' ? 'default' : 'arcane'}>
                {data.source === 'srd' ? 'Importado do SRD' : 'Homebrew'}
              </Badge>
              <Button
                variant="danger"
                size="xs"
                onClick={async () => {
                  if (!window.confirm('Excluir esta ameaça?')) return;
                  const done = await api.del(`/threats/${data.id}`).catch((err) => {
                    setError(err.message);
                    return null;
                  });
                  if (done) navigate('/homebrew');
                }}
              >
                Excluir
              </Button>
            </>
          ) : (
            <Button variant="primary" loading={busy} onClick={addToBestiary}>Adicionar ao meu bestiário</Button>
          )}
        </div>
      </header>

      <Alert>{error}</Alert>

      <div className="grid gap-5 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Combate" subtitle={profile.speedLabel ? `Deslocamento: ${profile.speedLabel}` : undefined} />
            <div className="grid gap-2 p-4 sm:grid-cols-4">
              <div className="stat-tile">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">CA</span>
                <span className="font-display text-xl text-arcane-300">
                  {profile.armorClass?.value ?? '—'}
                </span>
                <span className="text-[11px] text-slate-500">{profile.armorClass?.type ?? ''}</span>
              </div>
              <div className="stat-tile">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">PV</span>
                <span className="font-display text-xl text-neon-300">{profile.hitPoints}</span>
                <span className="text-[11px] text-slate-500">{profile.hitDice ?? ''}{profile.hitPointsRoll ? ` (${profile.hitPointsRoll})` : ''}</span>
              </div>
              <div className="stat-tile">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Prof.</span>
                <span className="font-display text-xl text-slate-100">{formatModifier(profile.profBonus)}</span>
              </div>
              <div className="stat-tile">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">XP</span>
                <span className="font-display text-xl text-gold">{profile.xp ?? '—'}</span>
              </div>
            </div>

            {isHomebrew ? (
              <div className="border-t border-ink-700/70 px-4 py-3">
                <p className="mb-2 text-xs text-slate-400">Ajustar PV durante o combate</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">PV {statblock.hit_points ?? 0}</span>
                  {statblock.temp_hp ? <span className="chip border-neon-500/40 bg-neon-500/10 text-neon-300">+{statblock.temp_hp} temp</span> : null}
                  <Button variant="ghost" size="xs" onClick={() => adjustHp({ delta: -5 })}>−5</Button>
                  <Button variant="ghost" size="xs" onClick={() => adjustHp({ delta: -1 })}>−1</Button>
                  <Button variant="ghost" size="xs" onClick={() => adjustHp({ delta: 1 })}>+1</Button>
                  <Button variant="ghost" size="xs" onClick={() => adjustHp({ delta: 5 })}>+5</Button>
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader title="Atributos e resistências" subtitle="Clique para rolar" />
            <div className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-6">
              {ABILITY_KEYS.map((key) => {
                const ability = profile.abilities?.[key];
                if (!ability) return null;
                return (
                  <RollButton
                    key={key}
                    variant="plain"
                    className="stat-tile text-center"
                    expression={`1d20${ability.mod >= 0 ? '+' : ''}${ability.mod}`}
                    label={`Teste de ${ABILITY_LABELS[key]}`}
                    title={`Rolar 1d20${formatModifier(ability.mod)}`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{ABILITY_ABBR[key]}</span>
                    <span className="font-display text-lg text-slate-100">{ability.score}</span>
                    <span className="text-[11px] text-slate-400">{ability.label}</span>
                  </RollButton>
                );
              })}
            </div>

            <div className="grid gap-3 border-t border-ink-700/70 p-4 sm:grid-cols-2">
              <div>
                <p className="section-title mb-2 text-xs">Testes de resistência</p>
                <div className="flex flex-wrap gap-1.5">
                  {ABILITY_KEYS.filter((key) => profile.savingThrows?.[key]).map((key) => (
                    <RollButton
                      key={key}
                      variant="ghost"
                      size="xs"
                      expression={`1d20${profile.savingThrows[key].bonus >= 0 ? '+' : ''}${profile.savingThrows[key].bonus}`}
                      label={`Resistência de ${ABILITY_LABELS[key]}`}
                    >
                      {ABILITY_ABBR[key]} {profile.savingThrows[key].label}
                    </RollButton>
                  ))}
                  {Object.values(profile.savingThrows ?? {}).every((value) => !value) ? (
                    <span className="text-xs text-slate-500">Sem resistências treinadas.</span>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="section-title mb-2 text-xs">Perícias</p>
                <div className="flex flex-wrap gap-1.5">
                  {(profile.skills ?? []).length === 0 ? (
                    <span className="text-xs text-slate-500">Nenhuma perícia listada.</span>
                  ) : (
                    profile.skills.map((skill) => (
                      <RollButton
                        key={skill.key}
                        variant="ghost"
                        size="xs"
                        expression={`1d20${skill.bonus >= 0 ? '+' : ''}${skill.bonus}`}
                        label={skill.name}
                      >
                        {skill.name} {skill.label}
                      </RollButton>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <ActionsPanel title="Ações" actions={profile.actions} />
          <ActionsPanel title="Ações lendárias" actions={profile.legendary} />
          <ActionsPanel title="Reações" actions={profile.reactions} />

          {(profile.specialAbilities ?? []).length > 0 ? (
            <Panel>
              <PanelHeader title="Habilidades especiais" />
              <div className="space-y-3 p-4">
                {profile.specialAbilities.map((ability) => (
                  <div key={ability.name}>
                    <p className="font-display text-sm text-arcane-200">{ability.name}</p>
                    <p className="whitespace-pre-line text-sm text-slate-300">{ability.description}</p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Detalhes" />
            <div className="space-y-3 p-4 text-sm">
              <DetailRow label="Sensos" value={formatObject(profile.senses)} />
              <DetailRow label="Idiomas" value={profile.languages || '—'} />
              <DetailRow label="Resistências a dano" value={profile.damageResistances.join(', ') || '—'} />
              <DetailRow label="Imunidades a dano" value={profile.damageImmunities.join(', ') || '—'} />
              <DetailRow
                label="Imunidades a condições"
                value={(profile.conditionImmunities ?? [])
                  .map((entry) => entry?.name ?? entry)
                  .join(', ') || '—'}
              />
            </div>
          </Panel>

          {busy ? (
            <div className="flex items-center gap-2 text-xs text-slate-500"><Spinner /> Processando…</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ActionsPanel({ title, actions }) {
  if (!actions || actions.length === 0) return null;
  return (
    <Panel>
      <PanelHeader title={title} subtitle="Clique nos valores para rolar" />
      <div className="space-y-4 p-4">
        {actions.map((action) => (
          <Card key={action.name} className="hover:border-ink-700/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm text-arcane-200">{action.name}</h3>
              {action.usages ? <Badge tone="gold">{action.usages}</Badge> : null}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {(action.attackRolls ?? []).map((roll) => (
                <RollButton
                  key={`atk-${roll.label}`}
                  variant="ghost"
                  size="xs"
                  expression={roll.expression}
                  label={`${action.name} — ${roll.label}`}
                >
                  {roll.label} {roll.expression}
                </RollButton>
              ))}
              {(action.damageRolls ?? []).map((roll) => (
                <RollButton
                  key={`dmg-${roll.label}`}
                  variant="ghost"
                  size="xs"
                  expression={roll.expression}
                  label={`Dano: ${action.name}`}
                >
                  {roll.label} {roll.expression}{roll.type ? ` ${roll.type}` : ''}
                </RollButton>
              ))}
              {action.save ? <span className="chip border-gold/40 bg-gold/10 text-gold">{action.save.label}</span> : null}
            </div>

            {action.description ? (
              <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{action.description}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </Panel>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-slate-300">{value}</p>
    </div>
  );
}

function formatObject(value) {
  const entries = Object.entries(value ?? {});
  if (entries.length === 0) return '—';
  const labels = { darkvision: 'visão no escuro', blindsight: 'percepção às cegas', tremorsense: 'sentido sísmico', truesight: 'visão verdadeira', passive_perception: 'percepção passiva' };
  return entries.map(([key, val]) => `${labels[key] ?? key} ${val}`).join(' · ');
}
