/** Lista de todas as fichas do jogador, com busca rápida. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CharacterCard } from '../components/CharacterCard.jsx';
import { CharacterCreateModal } from '../components/CharacterCreateModal.jsx';
import { Button, EmptyState, Input, LoadingScreen, Panel, PanelHeader } from '../components/ui.jsx';
import { api } from '../lib/api.js';

export default function Characters() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    () => api.get('/characters').then((data) => setCharacters(data.items ?? [])).catch(() => setCharacters([])),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!characters) return [];
    const term = search.trim().toLowerCase();
    if (!term) return characters;
    return characters.filter((character) =>
      `${character.name} ${character.classes}`.toLowerCase().includes(term),
    );
  }, [characters, search]);

  if (!characters) return <LoadingScreen />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-100">Personagens</h1>
          <p className="text-sm text-slate-400">Suas fichas de jogador — abertas para consulta e rolagem.</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>Nova ficha</Button>
      </header>

      <Panel>
        <PanelHeader
          title={`${filtered.length} fichas`}
          subtitle="Clique em uma ficha para abrir o grimório completo"
          action={
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou classe…"
              className="w-56"
            />
          }
        />
        <div className="p-4">
          {filtered.length === 0 ? (
            <EmptyState
              title={characters.length === 0 ? 'Nenhuma ficha ainda' : 'Nada encontrado'}
              description={
                characters.length === 0
                  ? 'Crie o primeiro personagem da mesa.'
                  : 'Tente outro termo de busca.'
              }
              action={
                characters.length === 0 ? (
                  <Button variant="primary" onClick={() => setCreating(true)}>Criar ficha</Button>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((character) => (
                <CharacterCard key={character.id} character={character} />
              ))}
            </div>
          )}
        </div>
      </Panel>

      <CharacterCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => {
          setCreating(false);
          navigate(`/personagens/${created.character.id}`);
        }}
      />
    </div>
  );
}
