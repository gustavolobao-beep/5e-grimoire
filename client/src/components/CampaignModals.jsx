import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Alert, Button, Field, Input, Modal, Select, Textarea } from './ui.jsx';

/** Criação de campanha: o Mestre recebe um código de convite único. */
export function CampaignCreateModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/campaigns', {
        name: form.name.trim(),
        description: form.description.trim() || null,
      });
      setForm({ name: '', description: '' });
      onCreated?.(data.campaign);
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
      title="Nova campanha"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="campaign-form" loading={loading}>Criar campanha</Button>
        </>
      }
    >
      <form id="campaign-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome da campanha">
          <Input required value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="A Maldição de Strahd" />
        </Field>
        <Field label="Sinopse" hint="Opcional — visível para os jogadores.">
          <Textarea
            value={form.description}
            onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
            placeholder="Campanha gótica em Ravenloft…"
          />
        </Field>
        <Alert>{error}</Alert>
      </form>
    </Modal>
  );
}

/** Entrada em campanha pelo código/link de convite, escolhendo a ficha. */
export function CampaignJoinModal({ open, onClose, onJoined, initialCode = '' }) {
  const [characters, setCharacters] = useState([]);
  const [form, setForm] = useState({ inviteCode: initialCode, characterId: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm((current) => ({ ...current, inviteCode: current.inviteCode || initialCode }));
    api.get('/characters').then((data) => {
      const items = data.items ?? [];
      setCharacters(items);
      setForm((c) => ({ ...c, characterId: items[0]?.id ?? '' }));
    }).catch(() => setCharacters([]));
  }, [open, initialCode]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/campaigns/join', {
        inviteCode: form.inviteCode.trim(),
        characterId: Number(form.characterId),
      });
      setForm({ inviteCode: '', characterId: '' });
      onJoined?.(data.campaign);
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
      title="Entrar em uma campanha"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="join-form" loading={loading} disabled={characters.length === 0}>
            Entrar
          </Button>
        </>
      }
    >
      <form id="join-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Código de convite" hint="O Mestre compartilha esse código com a mesa.">
          <Input
            required
            value={form.inviteCode}
            onChange={(e) => setForm((c) => ({ ...c, inviteCode: e.target.value.toUpperCase() }))}
            placeholder="Ex.: 7F3K92QD"
            className="font-mono uppercase tracking-widest"
          />
        </Field>

        <Field label="Com qual ficha você vai jogar?">
          {characters.length === 0 ? (
            <p className="text-sm text-slate-400">Você ainda não tem fichas. Crie uma em "Personagens".</p>
          ) : (
            <Select
              value={form.characterId}
              onChange={(e) => setForm((c) => ({ ...c, characterId: e.target.value }))}
            >
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name} — {character.classes || 'sem classe'} (nível {character.level})
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Alert>{error}</Alert>
      </form>
    </Modal>
  );
}
