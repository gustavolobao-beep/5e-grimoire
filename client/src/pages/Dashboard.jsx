/** Painel inicial: fichas ativas do jogador + campanhas que mestra/joga. */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CampaignCard } from '../components/CampaignCard.jsx';
import { CharacterCard } from '../components/CharacterCard.jsx';
import { CharacterCreateModal } from '../components/CharacterCreateModal.jsx';
import { CampaignCreateModal, CampaignJoinModal } from '../components/CampaignModals.jsx';
import { Button, Card, EmptyState, LoadingScreen, Panel, PanelHeader, StatTile } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState(null);
  const [campaigns, setCampaigns] = useState(null);
  const [createCharacter, setCreateCharacter] = useState(false);
  const [createCampaign, setCreateCampaign] = useState(false);
  const [joinCampaign, setJoinCampaign] = useState(false);

  const load = useCallback(async () => {
    const [charactersData, campaignsData] = await Promise.all([
      api.get('/characters'),
      api.get('/campaigns'),
    ]);
    setCharacters(charactersData.items ?? []);
    setCampaigns(campaignsData);
  }, []);

  useEffect(() => {
    load().catch(() => {
      setCharacters([]);
      setCampaigns({ mastering: [], playing: [] });
    });
  }, [load]);

  if (!characters || !campaigns) return <LoadingScreen />;

  const mastering = campaigns.mastering ?? [];
  const playing = campaigns.playing ?? [];
  const totalSlots = characters.reduce((sum, character) => sum + character.hpMax, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Bem-vindo de volta,</p>
          <h1 className="font-display text-2xl text-slate-100">{user?.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setCreateCharacter(true)}>Nova ficha</Button>
          <Button variant="ghost" onClick={() => setCreateCampaign(true)}>Nova campanha</Button>
          <Button variant="ghost" onClick={() => setJoinCampaign(true)}>Entrar com código</Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Fichas ativas" value={characters.length} />
        <StatTile label="Mestrando" value={mastering.length} accent="neon" />
        <StatTile label="Jogando" value={playing.length} accent="gold" />
        <StatTile label="PV somados" value={totalSlots} accent="slate" hint="entre todas as fichas" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <Panel>
          <PanelHeader
            title="Suas fichas"
            subtitle="Jogadores veem aqui seus personagens ativos"
            action={<Link to="/personagens" className="btn-ghost btn-xs">Ver todas</Link>}
          />
          <div className="p-4">
            {characters.length === 0 ? (
              <EmptyState
                title="Nenhuma ficha ainda"
                description="Crie seu primeiro personagem para começar a rolar dados."
                action={<Button variant="primary" onClick={() => setCreateCharacter(true)}>Criar ficha</Button>}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {characters.slice(0, 4).map((character) => (
                  <CharacterCard key={character.id} character={character} />
                ))}
              </div>
            )}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Campanhas que você mestra"
              action={<Button variant="ghost" size="xs" onClick={() => setCreateCampaign(true)}>Nova</Button>}
            />
            <div className="space-y-3 p-4">
              {mastering.length === 0 ? (
                <p className="text-sm text-slate-500">Você ainda não mestra nenhuma campanha.</p>
              ) : (
                mastering.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Campanhas que você joga"
              action={<Button variant="ghost" size="xs" onClick={() => setJoinCampaign(true)}>Entrar</Button>}
            />
            <div className="space-y-3 p-4">
              {playing.length === 0 ? (
                <p className="text-sm text-slate-500">Use um código de convite para entrar em uma mesa.</p>
              ) : (
                playing.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)
              )}
            </div>
          </Panel>

          <Card className="hover:border-ink-700/70">
            <h3 className="section-title">Atalhos</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <button type="button" className="btn-ghost justify-start" onClick={() => navigate('/ameacas')}>
                Bestiário
              </button>
              <button type="button" className="btn-ghost justify-start" onClick={() => navigate('/homebrew')}>
                Homebrew
              </button>
            </div>
          </Card>
        </div>
      </div>

      <CharacterCreateModal
        open={createCharacter}
        onClose={() => setCreateCharacter(false)}
        onCreated={(created) => {
          setCreateCharacter(false);
          navigate(`/personagens/${created.character.id}`);
        }}
      />
      <CampaignCreateModal
        open={createCampaign}
        onClose={() => setCreateCampaign(false)}
        onCreated={(campaign) => {
          setCreateCampaign(false);
          navigate(`/campanhas/${campaign.id}`);
        }}
      />
      <CampaignJoinModal
        open={joinCampaign}
        onClose={() => setJoinCampaign(false)}
        onJoined={(campaign) => {
          setJoinCampaign(false);
          navigate(`/campanhas/${campaign.id}`);
        }}
      />
    </div>
  );
}
