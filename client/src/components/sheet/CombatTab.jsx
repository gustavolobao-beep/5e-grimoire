import { useEffect, useState } from 'react';
import { RollButton, Rollable } from '../RollButton.jsx';
import { Alert, Button, Field, Input, Panel, PanelHeader, Select } from '../ui.jsx';
import { ABILITY_LABELS, formatModifier } from '../../lib/format.js';

const CONDITIONS = [
  'Amedrontado', 'Atordoado', 'Caído', 'Cego', 'Enfeitiçado', 'Envenenado', 'Impedido',
  'Incapacitado', 'Inconsciente', 'Invisível', 'Paralisado', 'Petrificado', 'Preso',
  'Sobrecarregado', 'Surdo',
];

/** Aba Combate: PV, CA, ataques roláveis, dados de vida e condições. */
export function CombatTab({ character, sheet, onAdjustHp, onPatch }) {
  const [hpDelta, setHpDelta] = useState('');
  const [conditions, setConditions] = useState(character.conditions ?? []);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => setConditions(character.conditions ?? []), [character.conditions]);

  const applyDelta = async (sign) => {
    const value = Number(hpDelta);
    if (!Number.isFinite(value) || value === 0) return;
    await onAdjustHp({ delta: sign * Math.abs(value) });
    setHpDelta('');
  };

  const saveConditions = (next) => {
    setConditions(next);
    onPatch({ conditions: next });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel className="lg:col-span-2">
        <PanelHeader
          title="Ataques"
          subtitle="Armas equipadas no inventário. Clique para rolar ataque e dano."
        />
        <div className="space-y-2 p-4">
          {sheet.attacks.length === 0 ? (
            <p className="text-sm text-slate-500">Equipe uma arma no inventário para gerar ataques.</p>
          ) : (
            sheet.attacks.map((attack) => (
              <div
                key={attack.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {attack.name}
                    {attack.proficient ? <span className="ml-2 text-[11px] text-arcane-300">proficiente</span> : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Acerto {attack.ability ? `(${attack.ability})` : ''} · {attack.damageDice}
                    {attack.damageBonusLabel ? ` ${attack.damageBonusLabel}` : ''}
                    {attack.damageType ? ` ${attack.damageType}` : ''}
                    {attack.range ? ` · alcance ${attack.range}` : ''}
                    {attack.properties?.length ? ` · ${attack.properties.join(', ')}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <RollButton
                    variant="primary"
                    size="xs"
                    target={{ kind: 'attack', key: attack.id }}
                    characterId={character.id}
                    label={`Ataque: ${attack.name}`}
                    title={`Rolar ataque ${attack.attackExpression}`}
                  >
                    Atacar {attack.attackExpression}
                  </RollButton>
                  <RollButton
                    variant="ghost"
                    size="xs"
                    target={{ kind: 'damage', key: attack.id }}
                    characterId={character.id}
                    label={`Dano: ${attack.name}`}
                    title={`Rolar dano ${attack.damageExpression}`}
                  >
                    Dano {attack.damageExpression}
                  </RollButton>
                  {attack.twoHandedExpression ? (
                    <RollButton
                      variant="ghost"
                      size="xs"
                      expression={attack.twoHandedExpression}
                      characterId={character.id}
                      label={`Dano (versátil): ${attack.name}`}
                      title="Dano com as duas mãos"
                    >
                      Versátil {attack.twoHandedExpression}
                    </RollButton>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel>
          <PanelHeader title="Pontos de vida" />
          <div className="space-y-3 p-4">
            <div className="flex items-end gap-3">
              <Field label="PV atual" className="flex-1">
                <Input
                  type="number"
                  value={sheet.hp.current}
                  onChange={(event) => onAdjustHp({ current: Number(event.target.value) })}
                />
              </Field>
              <Field label="Temp" className="w-20">
                <Input
                  type="number"
                  min={0}
                  value={sheet.hp.temp}
                  onChange={(event) => onAdjustHp({ temp: Number(event.target.value) })}
                />
              </Field>
              <Field label="Máx" className="w-20">
                <Input
                  type="number"
                  min={1}
                  title="Sobrescreve o PV máximo calculado"
                  defaultValue={sheet.hp.max}
                  onBlur={(event) => onPatch({ hpMaxOverride: Number(event.target.value) || null })}
                />
              </Field>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="quantidade"
                value={hpDelta}
                onChange={(event) => setHpDelta(event.target.value)}
                className="flex-1"
              />
              <Button variant="danger" onClick={() => applyDelta(-1)}>Dano</Button>
              <Button variant="neon" onClick={() => applyDelta(1)}>Cura</Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <RollButton variant="ghost" size="xs" target={{ kind: 'death-save' }} characterId={character.id} label="Teste de morte">
                Teste de morte
              </RollButton>
              <span className="text-[11px] text-slate-500">
                {sheet.hp.current <= 0 ? 'Inconsciente — role testes de morte.' : 'Consciente.'}
              </span>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Classe de Armadura" subtitle={sheet.armorClass.source} />
          <ul className="space-y-1.5 p-4 text-sm">
            <li className="flex justify-between text-slate-400">
              <span>Base</span><span className="text-slate-200">{sheet.armorClass.base}</span>
            </li>
            <li className="flex justify-between text-slate-400">
              <span>Escudo</span><span className="text-slate-200">+{sheet.armorClass.shieldBonus}</span>
            </li>
            <li className="flex justify-between text-slate-400">
              <span>Outros bônus</span>
              <Input
                type="number"
                className="h-7 w-20 py-0 text-right"
                defaultValue={sheet.armorClass.miscBonus}
                onBlur={(event) => onPatch({ armorClassBonus: Number(event.target.value) || 0 })}
              />
            </li>
            <li className="flex justify-between border-t border-ink-700/70 pt-2 font-display text-base text-slate-100">
              <span>Total</span><span>{sheet.armorClass.total}</span>
            </li>
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Dados de vida" />
          <div className="space-y-2 p-4">
            {sheet.hitDice.map((die) => (
              <div key={die.classIndex} className="flex items-center justify-between text-sm">
                <span className="text-slate-300 capitalize">{die.classIndex} · d{die.die}</span>
                <span className="text-slate-400">
                  {die.remaining} de {die.total} disponíveis
                </span>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <RollButton
                variant="ghost"
                size="xs"
                expression={`1d${sheet.hitDice[0]?.die ?? 8}`}
                characterId={character.id}
                label="Dado de vida"
              >
                Rolar dado de vida
              </RollButton>
              <Button
                variant="ghost"
                size="xs"
                onClick={() =>
                  onPatch({ hitDiceUsed: Object.fromEntries(sheet.hitDice.map((die) => [die.classIndex, die.used + 1])) })
                }
              >
                Marcar uso
              </Button>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Condições" />
          <div className="space-y-2 p-4">
            <Select
              value=""
              onChange={(event) => {
                const value = event.target.value;
                if (value && !conditions.includes(value)) saveConditions([...conditions, value]);
              }}
            >
              <option value="">Adicionar condição…</option>
              {CONDITIONS.filter((condition) => !conditions.includes(condition)).map((condition) => (
                <option key={condition} value={condition}>{condition}</option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-1.5">
              {conditions.length === 0 ? (
                <span className="text-xs text-slate-500">Nenhuma condição ativa.</span>
              ) : (
                conditions.map((condition) => (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => saveConditions(conditions.filter((entry) => entry !== condition))}
                    className="chip border-ember/40 bg-ember/10 text-ember"
                    title="Remover"
                  >
                    {condition} ×
                  </button>
                ))
              )}
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="lg:col-span-3">
        <PanelHeader title="Testes de resistência" subtitle="Clique para rolar" />
        <div className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-6">
          {sheet.savingThrows.map((save) => (
            <Rollable
              key={save.key}
              target={{ kind: 'save', key: save.key }}
              characterId={character.id}
              label={`Resistência de ${ABILITY_LABELS[save.key]}`}
              className="stat-tile"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {ABILITY_LABELS[save.key].slice(0, 3)}
              </span>
              <span className="font-display text-lg text-slate-100">{formatModifier(save.total)}</span>
            </Rollable>
          ))}
        </div>
      </Panel>
    </div>
  );
}
