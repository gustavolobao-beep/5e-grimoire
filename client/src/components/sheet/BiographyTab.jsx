import { useEffect, useState } from 'react';
import { Button, Field, Input, Panel, PanelHeader, Textarea } from '../ui.jsx';

const TEXT_FIELDS = [
  { key: 'appearance', label: 'Aparência', placeholder: 'Traços físicos, roupas, marcas…', rows: 3 },
  { key: 'personality', label: 'Traços de personalidade', rows: 3 },
  { key: 'ideals', label: 'Ideais', rows: 2 },
  { key: 'bonds', label: 'Vínculos', rows: 2 },
  { key: 'flaws', label: 'Fraquezas', rows: 2 },
  { key: 'backstory', label: 'História', placeholder: 'Da onde veio, o que busca…', rows: 7 },
  { key: 'notes', label: 'Anotações da mesa', placeholder: 'Itens guardados, aliados, objetivos…', rows: 4 },
];

/** Aba Biografia: identidade e história do personagem. */
export function BiographyTab({ character, onPatch }) {
  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm({
      playerName: character.playerName ?? '',
      raceIndex: character.raceIndex ?? '',
      backgroundIndex: character.backgroundIndex ?? '',
      alignmentIndex: character.alignmentIndex ?? '',
      appearance: character.appearance ?? '',
      personality: character.personality ?? '',
      ideals: character.ideals ?? '',
      bonds: character.bonds ?? '',
      flaws: character.flaws ?? '',
      backstory: character.backstory ?? '',
      notes: character.notes ?? '',
    });
    setDirty(false);
  }, [character]);

  const update = (key) => (event) => {
    setDirty(true);
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const save = async () => {
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value]),
    );
    const result = await onPatch(payload);
    if (result) setDirty(false);
  };

  return (
    <Panel>
      <PanelHeader
        title="Biografia"
        subtitle="Quem é esse personagem fora do combate"
        action={
          <Button variant="primary" size="xs" onClick={save} disabled={!dirty}>
            {dirty ? 'Salvar' : 'Salvo'}
          </Button>
        }
      />
      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome do jogador">
            <Input value={form.playerName ?? ''} onChange={update('playerName')} />
          </Field>
          <Field label="Alinhamento" hint="Index do catálogo (ex.: chaotic-good)">
            <Input value={form.alignmentIndex ?? ''} onChange={update('alignmentIndex')} placeholder="neutral-good" />
          </Field>
          <Field label="Raça" hint="Index do catálogo (ex.: elf)">
            <Input value={form.raceIndex ?? ''} onChange={update('raceIndex')} placeholder="elf" />
          </Field>
          <Field label="Antecedente" hint="Index do catálogo (ex.: acolyte)">
            <Input value={form.backgroundIndex ?? ''} onChange={update('backgroundIndex')} placeholder="acolyte" />
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {TEXT_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} className={field.rows >= 7 ? 'lg:col-span-2' : ''}>
              <Textarea
                rows={field.rows}
                value={form[field.key] ?? ''}
                onChange={update(field.key)}
                placeholder={field.placeholder}
              />
            </Field>
          ))}
        </div>
      </div>
    </Panel>
  );
}
