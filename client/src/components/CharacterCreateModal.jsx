import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { ABILITY_KEYS, ABILITY_LABELS } from '../lib/format.js';
import { Alert, Button, Field, Input, Modal, Select } from './ui.jsx';

const STANDARD_ARRAY = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
const DEFAULT_ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

/** Formulário de criação de ficha (nome, raça, classe e atributos). */
export function CharacterCreateModal({ open, onClose, onCreated }) {
  const [classes, setClasses] = useState([]);
  const [races, setRaces] = useState([]);
  const [form, setForm] = useState({
    name: '',
    playerName: '',
    raceIndex: '',
    classIndex: '',
    level: 1,
    abilities: { ...DEFAULT_ABILITIES },
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get('/catalog/classes').then((data) => setClasses(data.items ?? [])).catch(() => setClasses([]));
    api.get('/catalog/races').then((data) => setRaces(data.items ?? [])).catch(() => setRaces([]));
  }, [open]);

  const setAbility = (key) => (event) => {
    const value = Number(event.target.value);
    setForm((current) => ({ ...current, abilities: { ...current.abilities, [key]: value } }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.classIndex) {
      setError('Escolha uma classe.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await api.post('/characters', {
        name: form.name.trim(),
        playerName: form.playerName.trim() || null,
        raceIndex: form.raceIndex || null,
        abilities: form.abilities,
        classes: [{ classIndex: form.classIndex, level: Number(form.level) }],
      });
      setForm({ name: '', playerName: '', raceIndex: '', classIndex: '', level: 1, abilities: { ...DEFAULT_ABILITIES } });
      onCreated?.(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova ficha"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit" form="character-form" loading={loading}>Criar ficha</Button>
        </>
      }
    >
      <form id="character-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do personagem">
            <Input required value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Lia, a Ladina" />
          </Field>
          <Field label="Nome do jogador" hint="Opcional">
            <Input value={form.playerName} onChange={(e) => setForm((c) => ({ ...c, playerName: e.target.value }))} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Raça">
            <Select value={form.raceIndex} onChange={(e) => setForm((c) => ({ ...c, raceIndex: e.target.value }))}>
              <option value="">— escolher —</option>
              {races.map((race) => (
                <option key={race.index} value={race.index}>{race.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Classe">
            <Select required value={form.classIndex} onChange={(e) => setForm((c) => ({ ...c, classIndex: e.target.value }))}>
              <option value="">— escolher —</option>
              {classes.map((klass) => (
                <option key={klass.index} value={klass.index}>{klass.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nível" hint="Multiclasse é configurada na ficha.">
            <Input
              type="number"
              min={1}
              max={20}
              value={form.level}
              onChange={(e) => setForm((c) => ({ ...c, level: e.target.value }))}
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Atributos</span>
            <button
              type="button"
              className="btn-ghost btn-xs"
              onClick={() => setForm((c) => ({ ...c, abilities: { ...STANDARD_ARRAY } }))}
            >
              Usar conjunto padrão
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ABILITY_KEYS.map((key) => (
              <div key={key}>
                <span className="mb-1 block text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {ABILITY_LABELS[key].slice(0, 3)}
                </span>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  className="text-center"
                  value={form.abilities[key]}
                  onChange={setAbility(key)}
                />
              </div>
            ))}
          </div>
        </div>

        <Alert>{error}</Alert>
      </form>
    </Modal>
  );
}
