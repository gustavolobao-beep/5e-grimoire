import { useCallback, useEffect, useState } from 'react';
import { RollButton } from '../RollButton.jsx';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  Panel,
  PanelHeader,
  Select,
  Spinner,
} from '../ui.jsx';
import { api } from '../../lib/api.js';
import { SPELL_LEVEL_LABELS, SPELL_SCHOOL_LABELS, classNames, formatModifier } from '../../lib/format.js';

/** Modal de busca no catálogo 5e para adicionar magias à ficha. */
function SpellPicker({ open, onClose, onPick, casterClasses }) {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [classIndex, setClassIndex] = useState(casterClasses[0]?.classIndex ?? '');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/catalog/spells', {
        query: { search, level, class: classIndex || undefined, limit: 40 },
      });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, level, classIndex]);

  useEffect(() => {
    if (open) load().catch(() => setItems([]));
  }, [open, load]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar magia"
      width="max-w-3xl"
      footer={<Button variant="ghost" type="button" onClick={onClose}>Fechar</Button>}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Buscar">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bola de Fogo…" />
          </Field>
          <Field label="Círculo">
            <Select value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="">Todos</option>
              {SPELL_LEVEL_LABELS.map((label, index) => (
                <option key={label} value={index}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Classe" hint="Usa a lista de magias da classe">
            <Select value={classIndex} onChange={(event) => setClassIndex(event.target.value)}>
              <option value="">Todas</option>
              {casterClasses.map((entry) => (
                <option key={entry.classIndex} value={entry.classIndex}>{entry.className}</option>
              ))}
            </Select>
          </Field>
        </div>

        <p className="text-xs text-slate-500">
          {loading ? 'Buscando…' : `${total} magias encontradas`}
        </p>

        <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {items.map((spell) => (
            <li
              key={spell.index}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink-700/70 bg-ink-900/50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">
                  {spell.name}
                  <span className="ml-2 text-[11px] text-arcane-300">{SPELL_LEVEL_LABELS[spell.level]}</span>
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {SPELL_SCHOOL_LABELS[spell.school] ?? spell.school}
                  {spell.concentration ? ' · concentração' : ''}
                  {spell.ritual ? ' · ritual' : ''}
                </p>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={async () => {
                  await onPick({ spellIndex: spell.index, sourceClassIndex: classIndex || null });
                }}
              >
                Adicionar
              </Button>
            </li>
          ))}
          {!loading && items.length === 0 ? (
            <li className="py-6 text-center text-sm text-slate-500">Nenhuma magia encontrada.</li>
          ) : null}
        </ul>
      </div>
    </Modal>
  );
}

/** Linha de magia (truque ou de círculo), com descrição expansível. */
function SpellRow({ spell, character, expanded, onToggle, onUpdate, onRemove }) {
  const info = spell.catalog ?? {};
  const isOpen = expanded === spell.id;

  return (
    <li className="rounded-lg border border-ink-700/70 bg-ink-900/50">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => onToggle(isOpen ? null : spell.id)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="text-sm text-slate-200">{info.name ?? spell.spellIndex}</span>
          <span className="ml-2 text-[11px] text-slate-500">
            {SPELL_SCHOOL_LABELS[info.school] ?? ''}
            {info.concentration ? ' · concentração' : ''}
            {spell.sourceClassIndex ? ` · ${spell.sourceClassIndex}` : ''}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          {info.ritual ? <Badge tone="neon">ritual</Badge> : null}
          <Checkbox
            label="preparada"
            checked={spell.prepared}
            onChange={(event) => onUpdate(spell.id, { prepared: event.target.checked })}
          />
          <RollButton
            variant="ghost"
            size="xs"
            expression="1d20"
            characterId={character.id}
            label={`Teste: ${info.name ?? spell.spellIndex}`}
            title="Rolar 1d20 (sem modificador)"
          >
            d20
          </RollButton>
          <Button variant="danger" size="xs" onClick={() => onRemove(spell.id)}>×</Button>
        </div>
      </div>

      {isOpen ? (
        <div className="space-y-2 border-t border-ink-700/70 px-3 py-2.5 text-xs text-slate-400">
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span><span className="text-slate-500">Tempo:</span> {info.casting_time}</span>
            <span><span className="text-slate-500">Alcance:</span> {info.range}</span>
            <span>
              <span className="text-slate-500">Componentes:</span>{' '}
              {(info.components ?? []).join(', ')}
              {info.material ? ` (${info.material})` : ''}
            </span>
            <span><span className="text-slate-500">Duração:</span> {info.duration}</span>
          </p>
          {(info.desc ?? []).map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="leading-relaxed">{paragraph}</p>
          ))}
          {info.higher_level?.length ? (
            <p className="text-arcane-200">
              <span className="font-semibold">Em círculos superiores:</span>{' '}
              {info.higher_level.join(' ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Aba Magias: slots, usos diários e descrição vinda do catálogo. */
export function SpellsTab({ character, sheet, spells, onAdd, onUpdate, onRemove, onPatch }) {
  const [picker, setPicker] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const slots = sheet.spellSlots?.slots ?? {};
  const used = sheet.spellSlots?.used ?? {};
  const pact = sheet.spellSlots?.pact ?? null;
  const casterClasses = sheet.spellcasting?.perClass ?? [];

  const setUsed = (level, count) => {
    const next = { ...used };
    if (count <= 0) delete next[level];
    else next[level] = count;
    onPatch({ spellSlotsUsed: next });
  };

  // Truques (nível 0) ficam separados: não gastam slots e são muito usados em combate.
  const cantrips = spells
    .filter((spell) => (spell.catalog?.level ?? 0) === 0)
    .sort((a, b) => (a.catalog?.name ?? '').localeCompare(b.catalog?.name ?? ''));

  const leveledByCircle = spells
    .filter((spell) => (spell.catalog?.level ?? 0) > 0)
    .reduce((accumulator, spell) => {
      const level = spell.catalog.level;
      accumulator[level] ??= [];
      accumulator[level].push(spell);
      return accumulator;
    }, {});

  const spellRowProps = { character, expanded, onToggle: setExpanded, onUpdate, onRemove };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Slots de magia" subtitle="Clique nos marcadores para gastar/recuperar usos" />
          <div className="space-y-3 p-4">
            {Object.keys(slots).length === 0 && !pact ? (
              <p className="text-sm text-slate-500">
                Esta ficha não possui slots de magia. Adicione uma classe conjuradora em "Progressão".
              </p>
            ) : null}

            {Object.entries(slots).map(([level, total]) => {
              const spent = Number(used[level] ?? 0);
              return (
                <div key={level} className="flex flex-wrap items-center gap-3">
                  <span className="w-20 text-sm text-slate-300">{SPELL_LEVEL_LABELS[Number(level)]}</span>
                  <div className="flex gap-1.5">
                    {Array.from({ length: total }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        title={`${index + 1}º uso`}
                        onClick={() => setUsed(level, index + 1 === spent ? index : index + 1)}
                        className={classNames(
                          'h-5 w-5 rounded-full border transition-colors',
                          index < spent
                            ? 'border-ink-600 bg-ink-800'
                            : 'border-arcane-400/60 bg-arcane-500/30 hover:bg-arcane-500/60',
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">{total - spent} de {total} disponíveis</span>
                </div>
              );
            })}

            {pact ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neon-500/30 bg-neon-500/5 px-3 py-2">
                <span className="text-sm text-neon-300">Magia de Pacto</span>
                <div className="flex gap-1.5">
                  {Array.from({ length: pact.count }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() =>
                        onPatch({ pactSlotsUsed: index + 1 === sheet.spellSlots.pactUsed ? index : index + 1 })
                      }
                      className={classNames(
                        'h-5 w-5 rounded-full border transition-colors',
                        index < sheet.spellSlots.pactUsed
                          ? 'border-ink-600 bg-ink-800'
                          : 'border-neon-400/60 bg-neon-500/30 hover:bg-neon-500/60',
                      )}
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-400">
                  {pact.count} espaços de {pact.level}º círculo · recarregam em descanso curto
                </span>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Conjuração" />
          <div className="space-y-3 p-4">
            {sheet.spellcasting ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="stat-tile">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500">CD de magia</span>
                    <span className="font-display text-xl text-arcane-200">{sheet.spellcasting.saveDc}</span>
                  </div>
                  <div className="stat-tile">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500">Ataque</span>
                    <span className="font-display text-xl text-arcane-200">
                      {formatModifier(sheet.spellcasting.attackBonus)}
                    </span>
                  </div>
                </div>
                <RollButton
                  variant="primary"
                  size="xs"
                  className="w-full"
                  target={{ kind: 'spell-attack' }}
                  characterId={character.id}
                  label="Ataque de Magia"
                >
                  Rolar ataque de magia
                </RollButton>
                <ul className="space-y-1 pt-1 text-xs text-slate-400">
                  {casterClasses.map((entry) => (
                    <li key={entry.classIndex} className="flex justify-between">
                      <span className="capitalize">{entry.className}</span>
                      <span>CD {entry.saveDc} · ataque {formatModifier(entry.attackBonus)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-slate-500">Sem conjuração: nenhuma classe conjuradora na ficha.</p>
            )}

            <Button variant="ghost" size="xs" className="w-full" onClick={() => setPicker(true)}>
              + Adicionar magia
            </Button>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title={`Magias conhecidas (${spells.length})`}
          subtitle="Clique em uma magia para ver a descrição completa"
        />
        <div className="space-y-4 p-4">
          {spells.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma magia na ficha ainda.</p>
          ) : (
            <>
              {/* Seção fixa de Truques (nível 0): não gastam slots. */}
              <section className="rounded-xl border border-neon-500/35 bg-neon-500/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm uppercase tracking-[0.18em] text-neon-300">Truques</h3>
                    <p className="text-[11px] text-slate-500">Nível 0 · não gastam slots de magia</p>
                  </div>
                  <Badge tone="neon">{cantrips.length}</Badge>
                </div>
                {cantrips.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum truque conhecido.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {cantrips.map((spell) => (
                      <SpellRow key={spell.id} spell={spell} {...spellRowProps} />
                    ))}
                  </ul>
                )}
              </section>

              {/* Magias de 1º a 9º círculo. */}
              {Object.keys(leveledByCircle).length === 0 ? null : (
                <div className="space-y-4">
                  {Object.keys(leveledByCircle)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((level) => (
                      <div key={level}>
                        <h3 className="section-title mb-2">{SPELL_LEVEL_LABELS[level]}</h3>
                        <ul className="space-y-1.5">
                          {leveledByCircle[level].map((spell) => (
                            <SpellRow key={spell.id} spell={spell} {...spellRowProps} />
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </Panel>

      {sheet.spellSlots && spells.length === 0 ? <Alert tone="info">Dica: adicione magias pelo botão acima — a descrição vem do catálogo 5e do banco.</Alert> : null}

      <SpellPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={async (payload) => {
          await onAdd(payload);
          setPicker(false);
        }}
        casterClasses={casterClasses.length > 0 ? casterClasses : sheet.classes}
      />
    </div>
  );
}
