/** Lista de campanhas: as que o usuário mestra e as que joga. */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CampaignCard } from '../components/CampaignCard.jsx';
import { CampaignCreateModal, CampaignJoinModal } from '../components/CampaignModals.jsx';
import { Button, EmptyState, LoadingScreen, Panel, PanelHeader } from '../components/ui.jsx';
import { api } from '../lib/api.js';

export default function Campaigns() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const inviteCode = (params.get('codigo') ?? '').toUpperCase();
  const [campaigns, setCampaigns] = useState(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(Boolean(inviteCode));

  const load = useCallback(
    () => api.get('/campaigns')
      .then((data) => setCampaigns(data))
      .catch(() => setCampaigns({ mastering: [], playing: [] })),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const closeJoin = () => {
    setJoining(false);
    if (inviteCode) setParams({}, { replace: true });
  };

  if (!campaigns) return <LoadingScreen />;

  const mastering = campaigns.mastering ?? [];
  const playing = campaigns.playing ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-100">Campanhas</h1>
          <p className="text-sm text-slate-400">Mesas que você conduz como Mestre e mesas em que você joga.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setCreating(true)}>Nova campanha</Button>
          <Button variant="ghost" onClick={() => setJoining(true)}>Entrar com código</Button>
        </div>
      </header>

      <Panel>
        <PanelHeader
          title="Campanhas que você mestra"
          subtitle="Gere o link de convite e acompanhe os personagens no Escudo do Mestre"
          action={<Button variant="ghost" size="xs" onClick={() => setCreating(true)}>Nova</Button>}
        />
        <div className="p-4">
          {mastering.length === 0 ? (
            <EmptyState
              icon="☰"
              title="Nenhuma campanha mestrada"
              description="Crie uma sala e convide a mesa com um código exclusivo."
              action={<Button variant="primary" onClick={() => setCreating(true)}>Criar campanha</Button>}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mastering.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Campanhas que você joga"
          subtitle="Mesas em que você participa com uma ficha"
          action={<Button variant="ghost" size="xs" onClick={() => setJoining(true)}>Entrar</Button>}
        />
        <div className="p-4">
          {playing.length === 0 ? (
            <EmptyState
              icon="⚔"
              title="Você ainda não joga em nenhuma mesa"
              description='Peça o código de convite ao seu Mestre e use "Entrar com código".'
              action={<Button variant="primary" onClick={() => setJoining(true)}>Entrar com código</Button>}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {playing.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </div>
      </Panel>

      <CampaignCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(campaign) => {
          setCreating(false);
          navigate(`/campanhas/${campaign.id}`);
        }}
      />
      <CampaignJoinModal
        open={joining}
        initialCode={inviteCode}
        onClose={closeJoin}
        onJoined={(campaign) => {
          closeJoin();
          navigate(`/campanhas/${campaign.id}`);
        }}
      />
    </div>
  );
}
