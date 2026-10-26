import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Field, Input, Panel, PanelHeader, Select, StatTile } from '../ui.jsx';
import { useRealtime } from '../../context/RealtimeContext.jsx';
import { api } from '../../lib/api.js';
import { SPELL_LEVEL_LABELS, formatModifier } from '../../lib/format.js';

/** Aba Progressão: multiclasse, proficiência, dados de vida e slots resultantes. */
export function ProgressionTab({ character, sheet, classes, onUpdateClasses, onPatch }) {
  const { roll } = useRealtime();
  const [catalogClasses, setCatalogClasses] = useState([]);
  const [subclasses, setSubclasses] = useState({});
  const [draft, setDraft] = useState([]);
  const [ignorePrereqs, setIgnorePrereqs] = useState(false);
  const [xp, setXp] = useState(character.xp ?? 0);
  const [levelClass, setLevelClass] = useState('');
  const [levelBusy, setLevelBusy] = useState(false);
  const [levelMessage, setLevelMessage] = useState(null);

  useEffect(() => {
    api.get('/catalog/classes').then((data) => setCatalogClasses(data.items ?? [])).catch(() => setCatalogClasses([]));
  }, []);

  useEffect(() => {
    setDraft(
      classes.map((entry) => ({
        classIndex: entry.classIndex,
        subclassIndex: entry.subclassIndex ?? '',
        level: entry.level,
      })),
    );
  }, [classes]);

  useEffect(() => setXp(character.xp ?? 0), [character.xp]);

  // Mantém uma classe selecionada no assistente de subida de nível.
  useEffect(() => {
    if (!levelClass && classes[0]) setLevelClass(classes[0].classIndex);
  }, [classes, levelClass]);

  const loadSubclasses = useCallback(async (classIndex) => {
    if (!classIndex || subclasses[classIndex]) return;
    const data = await api.get('/catalog/subclasses', { query: { class: classIndex } });
    setSubclasses((current) => ({ ...current, [classIndex]: data.items ?? [] }));
  }, [subclasses]);

  useEffect(() => {
    draft.forEach((entry) => loadSubclasses(entry.classIndex));
  }, [draft, loadSubclasses]);

  const totalLevel = draft.reduce((sum, entry) => sum + (Number(entry.level) || 0), 0);

  const update = (index, patch) =>
    setDraft((current) => current.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)));

  const addClass = () =>
    setDraft((current) => [...current, { classIndex: '', subclassIndex: '', level: 1 }]);

  const removeClass = (index) => setDraft((current) => current.filter((_, position) => position !== index));

  const save = () =>
    onUpdateClasses(
      draft.map((entry) => ({
        classIndex: entry.classIndex,
        subclassIndex: entry.subclassIndex || null,
        level: Number(entry.level) || 1,
      })),
      ignorePrereqs,
    );

  const slots = sheet.spellSlots?.slots ?? {};

  // ---- Subida de nível (etapa interativa de Pontos de Vida) ---------------
  const levelClassEntry = classes.find((entry) => entry.classIndex === levelClass) ?? classes[0] ?? null;
  const hitDie = Number(levelClassEntry?.hitDie) || 8;
  const conMod = Number(sheet.abilityMods?.con) || 0;
  const averageGain = Math.floor(hitDie / 2) + 1;
  const nextLevel = (Number(levelClassEntry?.level) || 0) + 1;
  const maxedOut = !levelClassEntry || nextLevel > 20 || sheet.totalLevel >= 20;

  /**
   * Sobe um nível na classe escolhida registrando como o PV foi calculado:
   * "Pegar a Média" grava `null` (o motor usa a média do dado) e "Rolar o Dado"
   * grava o valor rolado pelo rolador oficial (aparece no log de dados).
   */
  const applyLevelUp = async (mode) => {
    if (!levelClassEntry || levelBusy) return;
    if (maxedOut) {
      setLevelMessage({ tone: 'warn', text: 'Nível máximo (20) já alcançado.' });
      return;
    }

    setLevelBusy(true);
    setLevelMessage(null);
    try {
      let dieValue = averageGain;
      let detail = `média do d${hitDie}`;

      if (mode === 'roll') {
        const rolled = await roll({
          expression: `1d${hitDie}`,
          label: `PV do nível ${nextLevel} (${levelClassEntry.className})`,
        });
        const value = Number(rolled?.result?.total);
        if (!Number.isFinite(value) || value < 1) throw new Error('Não foi possível registrar a rolagem de PV.');
        dieValue = value;
        detail = `d${hitDie} rolado (${value})`;
      }

      // O índice no array é o ordinal do nível: `null` = média, número = rolado.
      const ordinal = Number(levelClassEntry.level) || 0;
      const rolls = { ...(character.hpRolls ?? {}) };
      const list = [...(rolls[levelClassEntry.classIndex] ?? [])];
      while (list.length < ordinal) list.push(null);
      list[ordinal] = mode === 'roll' ? dieValue : null;
      rolls[levelClassEntry.classIndex] = list;

      const savedHp = await onPatch({ hpMode: 'rolled', hpRolls: rolls });
      if (!savedHp) throw new Error('Não foi possível gravar os Pontos de Vida do novo nível.');

      const nextClasses = classes.map((entry) => ({
        classIndex: entry.classIndex,
        subclassIndex: entry.subclassIndex ?? null,
        level: entry.classIndex === levelClassEntry.classIndex ? nextLevel : entry.level,
        hitDie: Number(entry.hitDie) || 8,
      }));
      const result = await onUpdateClasses(nextClasses, ignorePrereqs);
      if (!result) throw new Error('Não foi possível subir de nível.');

      setLevelMessage({
        tone: 'info',
        text: `${levelClassEntry.className} subiu para o nível ${nextLevel}: +${dieValue + conMod} PV `
          + `(${detail} ${formatModifier(conMod)} de CON). PV máximos agora: ${result.sheet.hp.max}.`,
      });
    } catch (error) {
      setLevelMessage({ tone: 'error', text: error.message });
    } finally {
      setLevelBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title="Subir de nível"
          subtitle="Etapa interativa: escolha a classe e como calcular os Pontos de Vida deste nível"
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Classe que sobe de nível">
              <Select value={levelClassEntry?.classIndex ?? ''} onChange={(event) => setLevelClass(event.target.value)}>
                {classes.map((entry) => (
                  <option key={entry.classIndex} value={entry.classIndex}>
                    {entry.className} (nível {entry.level} · d{entry.hitDie})
                  </option>
                ))}
              </Select>
            </Field>
            <StatTile label="Novo nível" value={levelClassEntry ? `${levelClassEntry.level} → ${nextLevel}` : '—'} />
            <StatTile label="Dado de vida" value={`d${hitDie}`} hint="um dado por nível" />
            <StatTile label="Mod. de Constituição" value={formatModifier(conMod)} accent="neon" hint="somado em cada nível" />
          </div>

          <p className="text-xs text-slate-400">
            <span className="text-slate-300">Pegar a Média:</span> {averageGain} {formatModifier(conMod)} ={' '}
            <strong className="text-slate-100">{averageGain + conMod} PV</strong>
            {' · '}
            <span className="text-slate-300">Rolar o Dado:</span> 1d{hitDie} {formatModifier(conMod)}
            {' '}(resultado entra no log de rolagens)
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" loading={levelBusy} disabled={maxedOut} onClick={() => applyLevelUp('average')}>
              Pegar a Média ({averageGain + conMod} PV)
            </Button>
            <Button variant="neon" loading={levelBusy} disabled={maxedOut} onClick={() => applyLevelUp('roll')}>
              Rolar o Dado (1d{hitDie} {formatModifier(conMod)})
            </Button>
          </div>

          {levelMessage ? <Alert tone={levelMessage.tone}>{levelMessage.text}</Alert> : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Classes e níveis"
          subtitle="Multiclasse: some os níveis para o bônus de proficiência e siga a tabela de slots multiclasse"
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="xs" onClick={addClass}>+ Classe</Button>
              <Button variant="primary" size="xs" onClick={save}>Salvar progressão</Button>
            </div>
          }
        />
        <div className="space-y-3 p-4">
          {totalLevel > 20 ? <Alert tone="warn">Nível total {totalLevel} acima do limite de 20.</Alert> : null}

          {draft.map((entry, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3 sm:grid-cols-[minmax(0,2fr),minmax(0,2fr),minmax(0,1fr),auto]"
            >
              <Field label="Classe" className="min-w-0">
                <Select value={entry.classIndex} onChange={(event) => update(index, { classIndex: event.target.value })}>
                  <option value="">— escolher —</option>
                  {catalogClasses.map((klass) => (
                    <option key={klass.index} value={klass.index}>{klass.name} (d{klass.hit_die})</option>
                  ))}
                </Select>
              </Field>
              <Field label="Subclasse" className="min-w-0">
                <Select
                  value={entry.subclassIndex}
                  onChange={(event) => update(index, { subclassIndex: event.target.value })}
                  disabled={!entry.classIndex}
                >
                  <option value="">— nenhuma —</option>
                  {(subclasses[entry.classIndex] ?? []).map((subclass) => (
                    <option key={subclass.index} value={subclass.index}>{subclass.data?.name ?? subclass.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Nível" className="min-w-0">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={entry.level}
                  onChange={(event) => update(index, { level: event.target.value })}
                />
              </Field>
              <div className="flex items-end">
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() => removeClass(index)}
                  disabled={draft.length === 1}
                  title={draft.length === 1 ? 'A ficha precisa de ao menos uma classe' : 'Remover classe'}
                >
                  Remover
                </Button>
              </div>
            </div>
          ))}

          <Checkbox
            label="Ignorar pré-requisitos de multiclasse (regra opcional da mesa)"
            checked={ignorePrereqs}
            onChange={(event) => setIgnorePrereqs(event.target.checked)}
          />

          <div className="flex items-end gap-3 border-t border-ink-700/70 pt-3">
            <Field label="Experiência (XP)" className="w-40">
              <Input type="number" min={0} value={xp} onChange={(event) => setXp(event.target.value)} />
            </Field>
            <Button variant="ghost" size="xs" onClick={() => onPatch({ xp: Number(xp) || 0 })}>Salvar XP</Button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Nível total" value={sheet.totalLevel} />
        <StatTile label="Bônus de proficiência" value={formatModifier(sheet.profBonus)} accent="neon" />
        <StatTile label="PV máximos" value={sheet.hp.max} accent="gold" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Dados de vida" subtitle="Um dado por nível, conforme a classe" />
          <div className="space-y-2 p-4 text-sm">
            {sheet.hitDice.map((die) => (
              <div key={die.classIndex} className="flex items-center justify-between">
                <span className="text-slate-300 capitalize">{die.classIndex}</span>
                <span className="text-slate-400">{die.total}× d{die.die}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Slots de magia" subtitle={`Modo: ${sheet.spellSlots?.mode ?? '—'} · nível de conjurador ${sheet.spellSlots?.casterLevel ?? 0}`} />
          <div className="space-y-1.5 p-4 text-sm">
            {Object.keys(slots).length === 0 ? (
              <p className="text-slate-500">Sem slots de magia.</p>
            ) : (
              Object.entries(slots).map(([level, total]) => (
                <div key={level} className="flex items-center justify-between">
                  <span className="text-slate-300">{SPELL_LEVEL_LABELS[Number(level)]}</span>
                  <span className="text-slate-400">{total} espaços</span>
                </div>
              ))
            )}
            {sheet.spellSlots?.pact ? (
              <p className="pt-1 text-neon-300">
                Magia de Pacto: {sheet.spellSlots.pact.count}× de {sheet.spellSlots.pact.level}º círculo
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="PV por nível" subtitle="Como o máximo foi calculado" />
          <ul className="max-h-56 space-y-1 overflow-y-auto p-4 text-xs text-slate-400">
            {(sheet.hp.perLevel ?? []).map((entry, index) => (
              <li key={index} className="flex justify-between">
                <span className="capitalize">Nível {index + 1} · {entry.classIndex} (d{entry.hitDie})</span>
                <span className="text-slate-300">{entry.value} <span className="text-slate-600">({entry.source})</span></span>
              </li>
            ))}
          </ul>
          <p className="border-t border-ink-700/70 px-4 py-2 text-[11px] text-slate-500">
            Modo atual: {sheet.hp.mode === 'rolled' ? 'valores rolados' : 'média do dado'} · o modificador de CON aplica-se por nível
          </p>
        </Panel>
      </div>
    </div>
  );
}
