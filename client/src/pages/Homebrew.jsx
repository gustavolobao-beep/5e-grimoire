/** Homebrew: ameaças criadas pelo Mestre, prontas para rolar na mesa. */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  LoadingScreen,
  Modal,
  Panel,
  PanelHeader,
  Select,
  Textarea,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatRelativeDate } from '../lib/format.js';

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const SIZE_LABEL = {
  Tiny: 'Minúsculo',
  Small: 'Pequeno',
  Medium: 'Médio',
  Large: 'Grande',
  Huge: 'Enorme',
  Gargantuan: 'Colossal',
};

const EMPTY_FORM = {
  name: '', size: 'Medium', type: '', alignment: '',
  armorClass: '', hitPoints: '', hitDice: '', speed: '',
  str: '', dex: '', con: '', int: '', wis: '', cha: '',
  challengeRating: '', xp: '',
  actionName: '', attackBonus: '', damageDice: '', damageType: '', actionDesc: '',
};

export default function Homebrew() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/threats', { query: { search: search || undefined } });
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err.message);
      setItems([]);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  if (!items && !error) return <LoadingScreen />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-100">Homebrew</h1>
          <p className="text-sm text-slate-400">Crie ameaças próprias, com PV, ataques e dano já roláveis.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/ameacas" className="btn-ghost">Ir ao bestiário</Link>
          <Button variant="primary" onClick={() => setCreating(true)}>Nova ameaça</Button>
        </div>
      </header>

      <Alert>{error}</Alert>

      <Panel>
        <PanelHeader
          title={`${items?.length ?? 0} ameaças`}
          subtitle="Fichas que você criou ou importou do SRD"
          action={<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="w-52" />}
        />
        <div className="p-4">
          {!items ? (
            <div className="flex justify-center py-10"><LoadingScreen /></div>
          ) : items.length === 0 ? (
            <EmptyState
              icon="☠"
              title={search ? 'Nada encontrado' : 'Nenhuma ameaça ainda'}
              description={search ? 'Tente outro termo.' : 'Crie sua primeira ameaça ou importe monstros do bestiário.'}
              action={!search ? <Button variant="primary" onClick={() => setCreating(true)}>Criar ameaça</Button> : null}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((threat) => (
                <ThreatCard
                  key={threat.id}
                  threat={threat}
                  onOpen={() => navigate(`/ameacas/${threat.id}`)}
                  onDelete={async () => {
                    if (!window.confirm(`Excluir "${threat.name}"?`)) return;
                    try {
                      await api.del(`/threats/${threat.id}`);
                      load();
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </Panel>

      <ThreatCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(threat) => {
          setCreating(false);
          navigate(`/ameacas/${threat.id}`);
        }}
      />
    </div>
  );
}

function ThreatCard({ threat, onOpen, onDelete }) {
  return (
    <div className="panel flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <h3 className="truncate font-display text-base text-slate-100 hover:text-white">{threat.name}</h3>
          <p className="truncate text-xs capitalize text-slate-400">
            {SIZE_LABEL[threat.size] ?? threat.size ?? '—'} · {threat.type ?? '—'}
          </p>
        </button>
        <Badge tone={threat.source === 'srd' ? 'default' : 'arcane'}>
          {threat.source === 'srd' ? 'SRD' : 'Homebrew'}
        </Badge>
      </div>

      <div className="flex gap-3 text-xs text-slate-500">
        <span>ND {threat.challengeRating ?? '—'}</span>
        <span>PV {threat.hitPoints ?? '—'}</span>
        <span>CA {threat.armorClass ?? '—'}</span>
      </div>

      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-[11px] text-slate-600">{formatRelativeDate(threat.updatedAt)}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="xs" onClick={onOpen}>Abrir</Button>
          <Button variant="ghost" size="xs" onClick={onDelete}>Excluir</Button>
        </div>
      </div>
    </div>
  );
}

function ThreatCreateModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/threats', {
        name: form.name.trim(),
        source: 'custom',
        isHomebrew: true,
        payload: buildPayload(form),
      });
      onCreated?.(data.threat);
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
      width="max-w-3xl"
      title="Nova ameaça"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="threat-form" loading={loading}>Criar ameaça</Button>
        </>
      }
    >
      <form id="threat-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input required value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Devorador de Sombras" />
          </Field>
          <Field label="Tipo">
            <Input value={form.type} onChange={(e) => set({ type: e.target.value })} placeholder="monstruosidade" />
          </Field>
          <Field label="Tamanho">
            <Select value={form.size} onChange={(e) => set({ size: e.target.value })}>
              {SIZES.map((size) => <option key={size} value={size}>{SIZE_LABEL[size]}</option>)}
            </Select>
          </Field>
          <Field label="Tendência">
            <Input value={form.alignment} onChange={(e) => set({ alignment: e.target.value })} placeholder="neutro e mau" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="CA">
            <Input value={form.armorClass} onChange={(e) => set({ armorClass: numeric(e.target.value) })} placeholder="15" />
          </Field>
          <Field label="PV">
            <Input value={form.hitPoints} onChange={(e) => set({ hitPoints: numeric(e.target.value) })} placeholder="68" />
          </Field>
          <Field label="Dados de vida">
            <Input value={form.hitDice} onChange={(e) => set({ hitDice: e.target.value })} placeholder="8d8+32" />
          </Field>
          <Field label="Deslocamento">
            <Input value={form.speed} onChange={(e) => set({ speed: e.target.value })} placeholder="9 m" />
          </Field>
        </div>

        <div>
          <p className="label">Atributos</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              ['str', 'FOR'], ['dex', 'DES'], ['con', 'CON'],
              ['int', 'INT'], ['wis', 'SAB'], ['cha', 'CAR'],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  value={form[key]}
                  onChange={(e) => set({ [key]: numeric(e.target.value) })}
                  placeholder="10"
                  className="text-center"
                />
              </Field>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nível de desafio (ND)">
            <Input value={form.challengeRating} onChange={(e) => set({ challengeRating: numeric(e.target.value, true) })} placeholder="4" />
          </Field>
          <Field label="XP">
            <Input value={form.xp} onChange={(e) => set({ xp: numeric(e.target.value) })} placeholder="1100" />
          </Field>
        </div>

        <div className="rounded-xl border border-ink-700/70 bg-ink-900/40 p-3">
          <p className="section-title mb-2 text-xs">Ação de ataque (opcional)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome da ação">
              <Input value={form.actionName} onChange={(e) => set({ actionName: e.target.value })} placeholder="Garra" />
            </Field>
            <Field label="Bônus de ataque">
              <Input value={form.attackBonus} onChange={(e) => set({ attackBonus: numericSigned(e.target.value) })} placeholder="+7" />
            </Field>
            <Field label="Dano (dados)">
              <Input value={form.damageDice} onChange={(e) => set({ damageDice: e.target.value })} placeholder="2d6+4" />
            </Field>
            <Field label="Tipo de dano">
              <Input value={form.damageType} onChange={(e) => set({ damageType: e.target.value })} placeholder="cortante" />
            </Field>
          </div>
          <Field label="Descrição" className="mt-3">
            <Textarea value={form.actionDesc} onChange={(e) => set({ actionDesc: e.target.value })} rows={2} placeholder="Corpo a corpo: +7 para acertar…" />
          </Field>
        </div>

        <Alert>{error}</Alert>
      </form>
    </Modal>
  );
}

function numeric(value, allowDecimal = false) {
  const pattern = allowDecimal ? /[^\d.]/g : /[^\d]/g;
  return String(value).replace(pattern, '');
}

function numericSigned(value) {
  return String(value).replace(/[^\d+-]/g, '');
}

/** Monta o statblock no formato aceito pela API a partir do formulário. */
function buildPayload(form) {
  const numberOrUndefined = (value) => (value === '' ? undefined : Number(value));

  const payload = {
    name: form.name.trim(),
    size: form.size || undefined,
    type: form.type.trim() || undefined,
    alignment: form.alignment.trim() || undefined,
    hit_points: numberOrUndefined(form.hitPoints),
    hit_dice: form.hitDice.trim() || undefined,
    challenge_rating: numberOrUndefined(form.challengeRating),
    xp: numberOrUndefined(form.xp),
    strength: numberOrUndefined(form.str),
    dexterity: numberOrUndefined(form.dex),
    constitution: numberOrUndefined(form.con),
    intelligence: numberOrUndefined(form.int),
    wisdom: numberOrUndefined(form.wis),
    charisma: numberOrUndefined(form.cha),
  };

  const armorClass = numberOrUndefined(form.armorClass);
  if (armorClass !== undefined) payload.armor_class = [{ type: 'natural', value: armorClass }];
  if (form.speed.trim()) payload.speed = { walk: form.speed.trim() };

  if (form.actionName.trim()) {
    payload.actions = [{
      name: form.actionName.trim(),
      desc: form.actionDesc.trim(),
      attack_bonus: numberOrUndefined(form.attackBonus),
      damage: form.damageDice.trim()
        ? [{ damage_dice: form.damageDice.trim(), damage_type: { name: form.damageType.trim() || 'Contundente' } }]
        : [],
    }];
  }

  return payload;
}
