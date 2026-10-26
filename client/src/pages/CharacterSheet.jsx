/** Ficha de personagem em 3 colunas: núcleo, perícias/resistências e abas de detalhe. */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RollButton } from '../components/RollButton.jsx';
import { BiographyTab } from '../components/sheet/BiographyTab.jsx';
import { CombatTab } from '../components/sheet/CombatTab.jsx';
import { InventoryTab } from '../components/sheet/InventoryTab.jsx';
import { ProgressionTab } from '../components/sheet/ProgressionTab.jsx';
import { SheetCore } from '../components/sheet/SheetCore.jsx';
import { SheetSkills } from '../components/sheet/SheetSkills.jsx';
import { SpellsTab } from '../components/sheet/SpellsTab.jsx';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  LoadingScreen,
  Panel,
  Spinner,
  Tabs,
} from '../components/ui.jsx';
import { useRealtimeEvent } from '../context/RealtimeContext.jsx';
import { api } from '../lib/api.js';
import { formatModifier } from '../lib/format.js';

export default function CharacterSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(null);
  const [tab, setTab] = useState('combate');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSheet(await api.get(`/characters/${id}`));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    setSheet(null);
    load();
  }, [load]);

  // O Mestre pode mexer nesta ficha pelo Escudo: mantemos a tela sincronizada.
  useRealtimeEvent('character:updated', (payload) => {
    if (String(payload?.characterId) === String(id)) load();
  });

  /** Executa uma mutação e já aplica a ficha recalculada devolvida pela API. */
  const mutate = useCallback(
    async (promise, { quiet = false } = {}) => {
      if (!quiet) setBusy(true);
      try {
        const data = await promise;
        if (data?.sheet) setSheet(data);
        setError(null);
        return data;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        if (!quiet) setBusy(false);
      }
    },
    [],
  );

  const patch = useCallback(
    (payload, options) => mutate(api.patch(`/characters/${id}`, payload), options),
    [id, mutate],
  );

  const adjustHp = useCallback(
    (payload) => mutate(api.patch(`/characters/${id}/hp`, payload)),
    [id, mutate],
  );

  const addInventory = useCallback(
    (payload) => mutate(api.post(`/characters/${id}/inventory`, payload)),
    [id, mutate],
  );

  const updateInventory = useCallback(
    (itemId, payload) => mutate(api.patch(`/characters/${id}/inventory/${itemId}`, payload)),
    [id, mutate],
  );

  const removeInventory = useCallback(
    (itemId) => mutate(api.del(`/characters/${id}/inventory/${itemId}`)),
    [id, mutate],
  );

  const addSpell = useCallback(
    (payload) => mutate(api.post(`/characters/${id}/spells`, payload)),
    [id, mutate],
  );

  const updateSpell = useCallback(
    (spellId, payload) => mutate(api.patch(`/characters/${id}/spells/${spellId}`, payload)),
    [id, mutate],
  );

  const removeSpell = useCallback(
    (spellId) => mutate(api.del(`/characters/${id}/spells/${spellId}`)),
    [id, mutate],
  );

  const updateClasses = useCallback(
    (classes, allowPrerequisiteOverride = false) =>
      mutate(api.put(`/characters/${id}/classes`, { classes, allowPrerequisiteOverride })),
    [id, mutate],
  );

  const rest = useCallback((type) => mutate(api.post(`/characters/${id}/rest`, { type })), [id, mutate]);

  const handleDelete = async () => {
    if (!window.confirm('Excluir esta ficha permanentemente?')) return;
    await api.del(`/characters/${id}`);
    navigate('/personagens');
  };

  if (error && !sheet) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Button variant="ghost" onClick={() => navigate('/personagens')}>Voltar para personagens</Button>
      </div>
    );
  }

  if (!sheet) return <LoadingScreen />;

  const { character, sheet: computed } = sheet;

  const tabs = [
    { id: 'combate', label: 'Combate' },
    { id: 'magias', label: 'Magias', badge: sheet.spells.length || undefined },
    { id: 'inventario', label: 'Inventário', badge: sheet.inventory.length || undefined },
    { id: 'progressao', label: 'Progressão' },
    { id: 'biografia', label: 'Biografia' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link to="/personagens" className="text-sm text-slate-400 hover:text-slate-200">← Personagens</Link>
        <div className="flex items-center gap-2">
          {busy ? <Spinner /> : null}
          <Button variant="danger" size="xs" onClick={handleDelete}>Excluir ficha</Button>
        </div>
      </div>

      <Alert>{error}</Alert>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 bg-panel-sheen p-5">
          <Avatar name={character.name} size={64} className="text-2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl text-slate-100">{character.name}</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              {computed.classes.map((entry) => `${entry.className} ${entry.level}`).join(' / ') || 'Sem classe'}
              {' · '}nível {computed.totalLevel}
              {character.playerName ? ` · jogado por ${character.playerName}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {computed.multiclass ? <Badge tone="arcane">Multiclasse</Badge> : null}
              <span className="chip">DV {computed.hitDice.map((die) => `${die.remaining}/${die.total}d${die.die}`).join(' · ') || '—'}</span>
              {computed.spellcasting ? (
                <span className="chip chip-arcane">
                  CD de magia {computed.spellcasting.saveDc} · ataque {formatModifier(computed.spellcasting.attackBonus)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RollButton
              target={{ kind: 'initiative' }}
              characterId={character.id}
              label="Iniciativa"
              variant="ghost"
              title="Rolar iniciativa"
            >
              Iniciativa {formatModifier(computed.initiative)}
            </RollButton>
            <Button variant="ghost" onClick={() => rest('short')} title="Recupera slots de pacto (Bruxo)">
              Descanso curto
            </Button>
            <Button variant="neon" onClick={() => rest('long')} title="Recupera PV, slots e metade dos dados de vida">
              Descanso longo
            </Button>
          </div>
        </div>

        {computed.warnings?.length > 0 ? (
          <div className="space-y-1.5 border-t border-ink-700/70 p-4">
            {computed.warnings.map((warning) => (
              <Alert key={warning} tone="warn">{warning}</Alert>
            ))}
          </div>
        ) : null}
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* Coluna esquerda: núcleo do personagem */}
        <SheetCore character={character} sheet={computed} onPatch={patch} onAdjustHp={adjustHp} />

        {/* Coluna central: perícias e testes de resistência */}
        <SheetSkills character={character} sheet={computed} onPatch={patch} />

        {/* Coluna direita: navegação em abas */}
        <div className="min-w-0 space-y-4 lg:col-span-2 xl:col-span-1">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />

          <div className="animate-fade-up">
            {tab === 'combate' ? (
              <CombatTab
                character={character}
                sheet={computed}
                onPatch={patch}
                onAdjustHp={adjustHp}
                onRest={rest}
              />
            ) : null}
            {tab === 'magias' ? (
              <SpellsTab
                character={character}
                sheet={computed}
                spells={sheet.spells}
                onAdd={addSpell}
                onUpdate={updateSpell}
                onRemove={removeSpell}
                onPatch={patch}
              />
            ) : null}
            {tab === 'inventario' ? (
              <InventoryTab
                character={character}
                sheet={computed}
                inventory={sheet.inventory}
                onAdd={addInventory}
                onUpdate={updateInventory}
                onRemove={removeInventory}
              />
            ) : null}
            {tab === 'progressao' ? (
              <ProgressionTab
                character={character}
                sheet={computed}
                classes={sheet.classes}
                onUpdateClasses={updateClasses}
                onPatch={patch}
              />
            ) : null}
            {tab === 'biografia' ? <BiographyTab character={character} onPatch={patch} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
