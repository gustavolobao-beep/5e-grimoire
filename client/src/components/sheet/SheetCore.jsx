/**
 * Coluna esquerda da ficha: o núcleo do personagem.
 * Atributos em um diagrama hexagonal (cada vértice rola o teste) e, abaixo,
 * os recursos vitais em destaque: PV, CA (em formato de brasão), deslocamento
 * e bônus de proficiência.
 */
import { useEffect, useState } from 'react';
import { useRoller } from '../RollButton.jsx';
import { Button, Checkbox, Field, HealthBar, Input, Panel, PanelHeader, StatTile } from '../ui.jsx';
import { ABILITY_ABBR, ABILITY_KEYS, ABILITY_LABELS, classNames, formatModifier } from '../../lib/format.js';

/** Posições (em % da caixa do diagrama) dos 6 vértices hexagonais. */
const HEX_POSITIONS = {
  str: { left: '50%', top: '18.5%' },
  dex: { left: '83%', top: '34%' },
  con: { left: '83%', top: '66%' },
  int: { left: '50%', top: '81.5%' },
  wis: { left: '17%', top: '66%' },
  cha: { left: '17%', top: '34%' },
};

/** Um vértice do hexágono: valor do atributo e modificador clicáveis para rolar. */
function AbilityHex({ characterId, abilityKey, value, modifier }) {
  const { run, pending } = useRoller();
  const label = `Teste de ${ABILITY_LABELS[abilityKey]}`;

  return (
    <button
      type="button"
      onClick={() => run({ target: { kind: 'ability', key: abilityKey }, characterId, label })}
      title={`Rolar ${label.toLowerCase()}`}
      style={{ ...HEX_POSITIONS[abilityKey], width: '33%', aspectRatio: '1 / 1.15' }}
      className="group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
    >
      <span
        aria-hidden
        className={classNames(
          'hex-clip absolute inset-0 border border-ink-700/80 bg-gradient-to-b from-ink-800 to-ink-900',
          'transition-colors duration-150 group-hover:from-arcane-500/25 group-hover:to-arcane-500/5',
          'group-focus-visible:border-arcane-500',
          pending && 'opacity-60',
        )}
      />
      <span className="relative flex h-full w-full flex-col items-center justify-center text-center">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
          {ABILITY_ABBR[abilityKey]}
        </span>
        <span className="font-display text-lg leading-none text-slate-100">{value}</span>
        <span className="text-[11px] text-arcane-300">{formatModifier(modifier)}</span>
      </span>
    </button>
  );
}

/** Brasão em que a Classe de Armadura é exibida. */
function ArmorCrest({ value, source }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="crest-clip w-[74px] bg-arcane-500/50 p-[2px]">
        <div className="crest-clip flex h-[92px] w-full flex-col items-center justify-center bg-gradient-to-b from-ink-850 to-ink-950">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">CA</span>
          <span className="font-display text-3xl leading-none text-slate-100">{value}</span>
        </div>
      </div>
      {source ? <span className="max-w-[110px] truncate text-[11px] text-slate-500" title={source}>{source}</span> : null}
    </div>
  );
}

export function SheetCore({ character, sheet, onPatch, onAdjustHp }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    setForm({
      abilities: { ...sheet.abilities },
      jackOfAllTrades: Boolean(character.jackOfAllTrades),
    });
  }, [sheet.abilities, character.jackOfAllTrades]);

  const handleSave = async () => {
    const result = await onPatch(form);
    if (result) setEditing(false);
  };

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title="Atributos"
          subtitle="Clique em um vértice para rolar o teste"
          action={
            <Button variant="ghost" size="xs" onClick={() => setEditing((value) => !value)}>
              {editing ? 'Cancelar' : 'Editar'}
            </Button>
          }
        />
        <div className="p-4">
          <div className="relative mx-auto w-full max-w-[300px]" style={{ aspectRatio: '1 / 1.05' }}>
            <svg
              aria-hidden
              viewBox="0 0 200 210"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full text-arcane-500/25"
            >
              <polygon
                points="100,38.9 166,71.4 166,138.6 100,171.2 34,138.6 34,71.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-arcane-500/40 bg-arcane-500/10 text-center shadow-glow">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Prof</span>
              <span className="font-display text-base leading-none text-arcane-200">{formatModifier(sheet.profBonus)}</span>
            </div>

            {ABILITY_KEYS.map((key) => (
              <AbilityHex
                key={key}
                characterId={character.id}
                abilityKey={key}
                value={sheet.abilities[key]}
                modifier={sheet.abilityMods[key]}
              />
            ))}
          </div>
        </div>

        {editing && form ? (
          <div className="space-y-4 border-t border-ink-700/70 p-4">
            <div className="grid grid-cols-3 gap-2">
              {ABILITY_KEYS.map((key) => (
                <Field key={key} label={ABILITY_ABBR[key]}>
                  <Input
                    type="number"
                    min={1}
                    max={40}
                    className="text-center"
                    value={form.abilities[key]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        abilities: { ...current.abilities, [key]: Number(event.target.value) },
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
            <Checkbox
              label="Meio Proficiente (Bardo)"
              checked={form.jackOfAllTrades}
              onChange={(event) => setForm((current) => ({ ...current, jackOfAllTrades: event.target.checked }))}
            />
            <div className="flex justify-end">
              <Button variant="primary" size="xs" onClick={handleSave}>Salvar atributos</Button>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel>
        <PanelHeader title="Recursos" subtitle="Vida, defesa e movimento" />
        <div className="space-y-4 p-4">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Pontos de vida</span>
              {sheet.hp.temp > 0 ? <span className="text-xs text-neon-300">+{sheet.hp.temp} temp</span> : null}
            </div>
            <p className="mt-1 font-display text-3xl text-slate-100">
              {sheet.hp.current}
              <span className="text-lg text-slate-500">/{sheet.hp.max}</span>
            </p>
            <HealthBar current={sheet.hp.current} max={sheet.hp.max} temp={sheet.hp.temp} className="mt-2" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button size="xs" variant="danger" onClick={() => onAdjustHp({ delta: -5 })}>-5</Button>
              <Button size="xs" variant="danger" onClick={() => onAdjustHp({ delta: -1 })}>-1</Button>
              <Button size="xs" variant="neon" onClick={() => onAdjustHp({ delta: 1 })}>+1</Button>
              <Button size="xs" variant="neon" onClick={() => onAdjustHp({ delta: 5 })}>+5</Button>
              <Button size="xs" variant="ghost" onClick={() => onAdjustHp({ current: sheet.hp.max })}>Curar tudo</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 items-center gap-3 border-t border-ink-700/70 pt-4">
            <div className="col-span-2 flex justify-center sm:col-span-1">
              <ArmorCrest value={sheet.armorClass.total} source={sheet.armorClass.source} />
            </div>
            <div className="col-span-2 grid gap-2 sm:col-span-1">
              <StatTile label="Deslocamento" value={`${sheet.speed} m`} hint="por turno" />
              <StatTile label="Proficiência" value={formatModifier(sheet.profBonus)} />
              <StatTile label="Percepção Passiva" value={sheet.passivePerception} accent="neon" />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
