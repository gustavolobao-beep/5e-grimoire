/**
 * Coluna central da ficha: perícias e testes de resistência.
 * Cada linha traz o modificador já calculado pelo motor de regras e caixas de
 * seleção para marcar proficiência (◆) e expertise (★). Clicar no nome rola o teste.
 */
import { useRoller } from '../RollButton.jsx';
import { Panel, PanelHeader } from '../ui.jsx';
import { ABILITY_ABBR, ABILITY_LABELS, formatModifier } from '../../lib/format.js';

/** Caixa de seleção compacta usada nas colunas de proficiência/expertise. */
function Mark({ checked, disabled, title, onChange }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      title={title}
      aria-label={title}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-ink-600 bg-ink-900 text-arcane-500 focus:ring-arcane-500/40 disabled:cursor-not-allowed disabled:opacity-30"
    />
  );
}

/** Linha de rolagem: nome clicável + rótulo do atributo e, à direita, o total. */
function RollLine({ label, abilityKey, total, onRoll }) {
  return (
    <button
      type="button"
      onClick={onRoll}
      title={`Rolar ${label}`}
      className="rollable min-w-0 flex-1 px-2 py-1 text-left"
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm text-slate-300">
          <span className="truncate">{label}</span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-600">
            {ABILITY_ABBR[abilityKey] ?? abilityKey}
          </span>
        </span>
        <span className="shrink-0 font-display text-sm text-slate-100">{formatModifier(total)}</span>
      </span>
    </button>
  );
}

export function SheetSkills({ character, sheet, onPatch }) {
  const { run } = useRoller();

  const saveProfs = sheet.savingThrows.filter((save) => save.proficient).map((save) => save.key);
  const skillProfs = sheet.skills.filter((skill) => skill.proficient).map((skill) => skill.key);
  const skillExp = sheet.skills.filter((skill) => skill.expertise).map((skill) => skill.key);

  const toggleSave = (key, checked) =>
    onPatch({ saveProficiencies: checked ? [...saveProfs, key] : saveProfs.filter((entry) => entry !== key) });

  const toggleSkill = (key, checked) => {
    const payload = { skillProficiencies: checked ? [...skillProfs, key] : skillProfs.filter((entry) => entry !== key) };
    // Sem proficiência não há expertise: desmarcar a proficiência limpa a estrela.
    if (!checked && skillExp.includes(key)) payload.skillExpertise = skillExp.filter((entry) => entry !== key);
    onPatch(payload);
  };

  const toggleExpertise = (key, checked) =>
    onPatch({ skillExpertise: checked ? [...skillExp, key] : skillExp.filter((entry) => entry !== key) });

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader title="Testes de Resistência" subtitle="Clique no nome para rolar · ◆ proficiente" />
        <ul className="divide-y divide-ink-700/50">
          {sheet.savingThrows.map((save) => (
            <li key={save.key} className="flex items-center gap-2 px-4 py-1.5">
              <Mark
                checked={save.proficient}
                title={`Proficiência em resistência de ${ABILITY_LABELS[save.key]}`}
                onChange={(checked) => toggleSave(save.key, checked)}
              />
              <RollLine
                label={ABILITY_LABELS[save.key]}
                abilityKey={save.key}
                total={save.total}
                onRoll={() =>
                  run({
                    target: { kind: 'save', key: save.key },
                    characterId: character.id,
                    label: `Resistência de ${ABILITY_LABELS[save.key]}`,
                  })
                }
              />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader
          title="Perícias"
          subtitle={`Percepção passiva ${sheet.passivePerception} · proficiência ${formatModifier(sheet.profBonus)}`}
        />
        <div className="flex items-center gap-2 border-b border-ink-700/70 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          <span className="w-4">◆</span>
          <span className="flex-1">Perícia / modificador</span>
          <span className="w-4">★</span>
        </div>
        <ul className="divide-y divide-ink-700/50">
          {sheet.skills.map((skill) => (
            <li key={skill.key} className="flex items-center gap-2 px-4 py-1.5">
              <Mark
                checked={skill.proficient}
                title={`Proficiência em ${skill.name}`}
                onChange={(checked) => toggleSkill(skill.key, checked)}
              />
              <RollLine
                label={skill.name}
                abilityKey={skill.ability}
                total={skill.total}
                onRoll={() =>
                  run({ target: { kind: 'skill', key: skill.key }, characterId: character.id, label: skill.name })
                }
              />
              <Mark
                checked={skill.expertise}
                disabled={!skill.proficient}
                title={`Expertise em ${skill.name}`}
                onChange={(checked) => toggleExpertise(skill.key, checked)}
              />
            </li>
          ))}
        </ul>
        <p className="border-t border-ink-700/70 px-4 py-2 text-[11px] text-slate-500">
          ◆ proficiente · ★ expertise (dobra a proficiência)
        </p>
      </Panel>
    </div>
  );
}
