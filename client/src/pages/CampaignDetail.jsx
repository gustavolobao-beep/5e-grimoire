/** Detalhe da campanha: convite, membros e acesso ao Escudo do Mestre. */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  HealthBar,
  Input,
  LoadingScreen,
  Panel,
  PanelHeader,
  Select,
  Spinner,
  Textarea,
} from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { api } from '../lib/api.js';
import { formatRelativeDate, pluralize } from '../lib/format.js';

const STATUS_LABEL = { active: 'ativa', paused: 'pausada', finished: 'encerrada' };

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setCampaignId, loadLog } = useRealtime();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = useCallback(async () => {
    try {
      const result = await api.get(`/campaigns/${id}`);
      setData(result);
      setForm({ name: result.campaign.name, description: result.campaign.description ?? '' });
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // O log de rolagens passa a ser o da campanha aberta.
  useEffect(() => {
    setCampaignId(id);
    loadLog({ campaignId: id }).catch(() => {});
    return () => setCampaignId(null);
  }, [id, setCampaignId, loadLog]);

  const mutate = useCallback(async (promise) => {
    setBusy(true);
    try {
      const result = await promise;
      await load();
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [load]);

  const copyInvite = async () => {
    const link = `${window.location.origin}/campanhas?codigo=${data.inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar — copie o código manualmente.');
    }
  };

  if (!data && !error) return <LoadingScreen />;
  if (!data) return <Alert className="mt-4">{error}</Alert>;

  const { campaign, isDm, members, myMembership, inviteCode } = data;

  return (
    <div className="space-y-5">
      <nav className="text-xs text-slate-500">
        <Link to="/campanhas" className="hover:text-arcane-300">Campanhas</Link>
        <span className="px-1.5">/</span>
        <span className="text-slate-400">{campaign.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl text-slate-100">{campaign.name}</h1>
            <Badge tone={isDm ? 'arcane' : 'neon'}>{isDm ? 'Você é o Mestre' : 'Você é jogador'}</Badge>
            <Badge tone={campaign.status === 'active' ? 'neon' : 'gold'}>{STATUS_LABEL[campaign.status] ?? campaign.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Criada em {formatRelativeDate(campaign.createdAt)} · {pluralize(members.length, 'membro', 'membros')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDm ? (
            <>
              <Button variant="neon" onClick={() => navigate(`/campanhas/${id}/escudo`)}>Escudo do Mestre</Button>
              <Button variant="ghost" onClick={() => setEditing((value) => !value)}>Editar</Button>
            </>
          ) : null}
        </div>
      </header>

      <Alert>{error}</Alert>

      <div className="grid gap-5 lg:grid-cols-[1.6fr,1fr]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Sinopse" subtitle="Compartilhada com toda a mesa" />
            {editing && isDm ? (
              <div className="space-y-3 p-4">
                <Field label="Nome">
                  <Input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
                </Field>
                <Field label="Sinopse">
                  <Textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" type="button" onClick={() => setEditing(false)}>Cancelar</Button>
                  <Button
                    variant="primary"
                    type="button"
                    loading={busy}
                    onClick={async () => {
                      const done = await mutate(api.patch(`/campaigns/${id}`, {
                        name: form.name.trim(),
                        description: form.description.trim() || null,
                      }));
                      if (done) setEditing(false);
                    }}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm text-slate-300">
                {campaign.description ? <p className="whitespace-pre-line">{campaign.description}</p> : <p className="text-slate-500">Sem sinopse ainda.</p>}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Membros da mesa"
              subtitle={isDm ? 'Remova jogadores que saíram da campanha' : 'Acompanhe quem está na mesa'}
            />
            <div className="space-y-3 p-4">
              {members.length === 0 ? (
                <EmptyState
                  icon="☰"
                  title="Ninguém vinculado ainda"
                  description={isDm ? 'Compartilhe o código de convite para a mesa entrar.' : undefined}
                />
              ) : (
                members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isDm={isDm}
                    isMine={member.userId === user?.id}
                    busy={busy}
                    onRemove={() => mutate(api.del(`/campaigns/${id}/members/${member.id}`))}
                  />
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          {isDm ? (
            <Panel>
              <PanelHeader title="Convite" subtitle="Um link/código exclusivo para esta mesa" />
              <div className="space-y-3 p-4">
                <div className="rounded-lg border border-arcane-500/40 bg-arcane-500/10 px-4 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-arcane-300">Código de convite</p>
                  <p className="font-mono text-2xl tracking-[0.3em] text-arcane-100">{inviteCode}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={copyInvite}>{copied ? 'Copiado!' : 'Copiar link de convite'}</Button>
                  <Button
                    variant="ghost"
                    loading={busy}
                    onClick={() => mutate(api.post(`/campaigns/${id}/invite-code`))}
                  >
                    Gerar novo
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  O jogador abre o link, escolhe uma ficha e entra na mesa.
                </p>

                <Field label="Situação da campanha" className="pt-2">
                  <Select
                    value={campaign.status}
                    onChange={(e) => mutate(api.patch(`/campaigns/${id}`, { status: e.target.value }))}
                    disabled={busy}
                  >
                    <option value="active">Ativa</option>
                    <option value="paused">Pausada</option>
                    <option value="finished">Encerrada</option>
                  </Select>
                </Field>

                <Button
                  variant="danger"
                  className="w-full"
                  loading={busy}
                  onClick={async () => {
                    if (!window.confirm('Excluir esta campanha? Os personagens não são apagados.')) return;
                    const done = await api.del(`/campaigns/${id}`).catch((err) => {
                      setError(err.message);
                      return null;
                    });
                    if (done) navigate('/campanhas');
                  }}
                >
                  Excluir campanha
                </Button>
              </div>
            </Panel>
          ) : (
            <Panel>
              <PanelHeader title="Sua participação" />
              <div className="space-y-3 p-4">
                {myMembership?.summary ? (
                  <Card>
                    <div className="flex items-center gap-3">
                      <Avatar name={myMembership.characterName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm text-slate-100">{myMembership.characterName}</p>
                        <p className="truncate text-xs text-slate-400">
                          {myMembership.summary.classes} · nível {myMembership.summary.level}
                        </p>
                      </div>
                      <Link to={`/personagens/${myMembership.characterId}`} className="btn-ghost btn-xs">Abrir</Link>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>PV {myMembership.summary.hpCurrent}/{myMembership.summary.hpMax}</span>
                        <span>CA {myMembership.summary.armorClass}</span>
                      </div>
                      <HealthBar current={myMembership.summary.hpCurrent} max={myMembership.summary.hpMax} />
                    </div>
                  </Card>
                ) : (
                  <p className="text-sm text-slate-500">Você ainda não vinculou uma ficha a esta mesa.</p>
                )}

                <Button
                  variant="danger"
                  className="w-full"
                  loading={busy}
                  onClick={async () => {
                    if (!window.confirm('Sair desta campanha?')) return;
                    const done = await api.del(`/campaigns/${id}/members/${myMembership.id}`).catch((err) => {
                      setError(err.message);
                      return null;
                    });
                    if (done) navigate('/campanhas');
                  }}
                  disabled={!myMembership}
                >
                  Sair da campanha
                </Button>
              </div>
            </Panel>
          )}

          {busy ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Spinner /> Sincronizando…
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, isDm, isMine, busy, onRemove }) {
  const summary = member.summary;
  return (
    <Card className="hover:border-ink-700/70">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={member.characterName ?? member.userName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display text-sm text-slate-100">{member.characterName ?? 'Sem ficha'}</p>
            {isMine ? <Badge tone="neon">você</Badge> : null}
          </div>
          <p className="truncate text-xs text-slate-400">
            {member.userName ?? member.userEmail}
            {summary ? ` · ${summary.classes} (nível ${summary.level})` : ''}
          </p>
        </div>
        {(isDm || isMine) ? (
          <Button variant="ghost" size="xs" loading={busy} onClick={onRemove}>
            {isMine ? 'Sair' : 'Remover'}
          </Button>
        ) : null}
      </div>

      {summary ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="CA" value={summary.armorClass} />
            <MiniStat label="P. Passiva" value={summary.passivePerception} />
            <MiniStat label="Iniciativa" value={summary.initiative >= 0 ? `+${summary.initiative}` : summary.initiative} />
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>
                PV {summary.hpCurrent}/{summary.hpMax}
                {summary.hpTemp > 0 ? <span className="text-neon-300"> +{summary.hpTemp}</span> : null}
              </span>
              {summary.isUnconscious ? <span className="text-ember">inconsciente</span> : null}
            </div>
            <HealthBar current={summary.hpCurrent} max={summary.hpMax} temp={summary.hpTemp} />
          </div>
        </>
      ) : null}
    </Card>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-900/60 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-display text-sm text-slate-100">{value}</p>
    </div>
  );
}
