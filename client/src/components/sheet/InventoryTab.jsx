import { useCallback, useEffect, useState } from 'react';
import { resolveItemKind } from '@shared/rules/index.js';
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Panel,
  PanelHeader,
  Select,
} from '../ui.jsx';
import { RollButton } from '../RollButton.jsx';
import { api } from '../../lib/api.js';
import { ABILITY_ABBR, ABILITY_KEYS, classNames, formatModifier } from '../../lib/format.js';

const KIND_LABELS = { weapon: 'Arma', armor: 'Armadura', shield: 'Escudo', gear: 'Equipamento', magic: 'Mágico' };

const MODIFIER_TYPE_LABELS = {
  armor: 'Armadura',
  shield: 'Escudo',
  weapon: 'Arma',
  magic_item: 'Item mágico',
  other: 'Outro',
};

/**
 * Caixa de seleção personalizada (dark/neon) que alterna "equipado".
 * O input nativo fica invisível sobre o marcador para manter acessibilidade
 * (foco, teclado e leitores de tela) sem perder o visual do projeto.
 */
function EquipCheckbox({ checked, onChange, title }) {
  return (
    <label
      title={title}
      className="group relative inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center"
    >
      <input
        type="checkbox"
        checked={checked}
        aria-label={title}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute inset-0 cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className={classNames(
          'pointer-events-none flex h-6 w-6 items-center justify-center rounded-md border bg-ink-900 text-transparent',
          'transition-all duration-150 group-hover:border-arcane-500/70 group-hover:shadow-glow',
          'peer-checked:border-arcane-500 peer-checked:bg-arcane-500/20 peer-checked:text-arcane-200',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-arcane-500/40',
          checked ? 'border-arcane-500 shadow-glow' : 'border-ink-600',
        )}
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      </span>
    </label>
  );
}

/** Lê o array de modificadores dinâmicos guardado no item. */
function readModifiers(item) {
  return Array.isArray(item?.customData?.modifiers) ? item.customData.modifiers : [];
}

/** Resumo textual dos modificadores de um item (ex.: "+2 CA · +1 FOR"). */
function modifiersSummary(item) {
  return readModifiers(item)
    .flatMap((modifier) => {
      const parts = [];
      if (Number(modifier.ac_bonus)) parts.push(`${formatModifier(Number(modifier.ac_bonus))} CA`);
      if (Number(modifier.save_bonus)) parts.push(`${formatModifier(Number(modifier.save_bonus))} resistências`);
      for (const [key, value] of Object.entries(modifier.stat_boost ?? {})) {
        if (Number(value)) parts.push(`${formatModifier(Number(value))} ${ABILITY_ABBR[key] ?? key}`);
      }
      return parts;
    })
    .join(' · ');
}

/** Detalhe curto do item do catálogo (dano, CA, propriedades…). */
function itemSummary(catalog = {}) {
  const parts = [];
  if (catalog.damage?.damage_dice) {
    parts.push(`${catalog.damage.damage_dice} ${catalog.damage.damage_type?.name ?? ''}`.trim());
  }
  if (catalog.armor_class?.base) {
    parts.push(`CA ${catalog.armor_class.base}${catalog.armor_class.dex_bonus ? ' + DES' : ''}`);
  }
  if (catalog.armor_category === 'Shield' || catalog.index === 'shield') parts.push('+2 CA');
  if ((catalog.properties ?? []).length > 0) {
    parts.push(catalog.properties.map((property) => property.name ?? property).join(', '));
  }
  if (catalog.rarity) parts.push(catalog.rarity);
  return parts.join(' · ');
}

/** Modal de busca de itens no catálogo 5e (ou criação de item personalizado). */
function ItemPicker({ open, onClose, onPick }) {
  const [tab, setTab] = useState('equipment');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState({ name: '', kind: 'gear', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = tab === 'magic' ? '/catalog/magic-items' : '/catalog/equipment';
      const data = await api.get(endpoint, {
        query: { search, kind: tab === 'equipment' ? kind : undefined, limit: 50 },
      });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [tab, search, kind]);

  useEffect(() => {
    if (open) load().catch(() => setItems([]));
  }, [open, load]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar item ao inventário"
      width="max-w-3xl"
      footer={<Button variant="ghost" type="button" onClick={onClose}>Fechar</Button>}
    >
      <div className="space-y-3">
        <div className="flex gap-1 border-b border-ink-700/70 pb-2">
          {[
            { id: 'equipment', label: 'Equipamento' },
            { id: 'magic', label: 'Itens mágicos' },
            { id: 'custom', label: 'Personalizado' },
          ].map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={classNames(
                'rounded-lg px-3 py-1.5 text-sm',
                tab === entry.id ? 'bg-arcane-500/15 text-arcane-100' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === 'custom' ? (
          <div className="space-y-3">
            <Field label="Nome do item">
              <Input value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} placeholder="Lâmina do Crepúsculo" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                <Select value={custom.kind} onChange={(e) => setCustom((c) => ({ ...c, kind: e.target.value }))}>
                  {Object.entries(KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Observações">
                <Input value={custom.notes} onChange={(e) => setCustom((c) => ({ ...c, notes: e.target.value }))} />
              </Field>
            </div>
            <Button
              variant="primary"
              disabled={!custom.name.trim()}
              onClick={async () => {
                await onPick({ customName: custom.name.trim(), kind: custom.kind, notes: custom.notes || null });
                setCustom({ name: '', kind: 'gear', notes: '' });
              }}
            >
              Adicionar item personalizado
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Buscar" className="sm:col-span-2">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cota de Malha…" />
              </Field>
              {tab === 'equipment' ? (
                <Field label="Categoria">
                  <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                    <option value="">Todas</option>
                    <option value="weapon">Armas</option>
                    <option value="armor">Armaduras</option>
                    <option value="shield">Escudos</option>
                    <option value="gear">Equipamento</option>
                  </Select>
                </Field>
              ) : <div />}
            </div>

            <p className="text-xs text-slate-500">{loading ? 'Buscando…' : `${total} itens encontrados`}</p>

            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {items.map((item) => (
                <li
                  key={item.index}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink-700/70 bg-ink-900/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-200">{item.name}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {KIND_LABELS[item.kind] ?? item.kind} — {itemSummary(item.data)}
                    </p>
                  </div>
                  <Button size="xs" variant="ghost" onClick={() => onPick({ itemIndex: item.index })}>
                    Adicionar
                  </Button>
                </li>
              ))}
              {!loading && items.length === 0 ? (
                <li className="py-6 text-center text-sm text-slate-500">Nenhum item encontrado.</li>
              ) : null}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Editor dos modificadores dinâmicos de um item (CA, resistências e atributos). */
function ModifierEditor({ item, open, onClose, onSave }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!open) return;
    setRows(
      readModifiers(item).map((modifier) => {
        const [ability, value] = Object.entries(modifier.stat_boost ?? {})[0] ?? ['', 0];
        return {
          type: modifier.type ?? 'magic_item',
          ac_bonus: Number(modifier.ac_bonus) || 0,
          save_bonus: Number(modifier.save_bonus) || 0,
          ability: ability ?? '',
          value: Number(value) || 0,
        };
      }),
    );
  }, [open, item]);

  const update = (index, patch) =>
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  const handleSave = async () => {
    const modifiers = rows
      .map((row) => {
        const modifier = { type: row.type };
        if (Number(row.ac_bonus)) modifier.ac_bonus = Number(row.ac_bonus);
        if (Number(row.save_bonus)) modifier.save_bonus = Number(row.save_bonus);
        if (row.ability && Number(row.value)) modifier.stat_boost = { [row.ability]: Number(row.value) };
        return modifier;
      })
      .filter((modifier) => modifier.ac_bonus || modifier.save_bonus || modifier.stat_boost);

    await onSave({ ...(item.customData ?? {}), modifiers });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Modificadores — ${item?.name ?? 'item'}`}
      width="max-w-2xl"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="button" onClick={handleSave}>Salvar modificadores</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Aplicados automaticamente nos cálculos <strong>quando o item estiver equipado</strong> (ex.: um anel com
          <span className="font-mono"> +1 CA</span> e <span className="font-mono">+2 FOR</span>).
        </p>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-700 px-3 py-6 text-center text-sm text-slate-500">
            Nenhum modificador. Adicione um abaixo.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li
                key={index}
                className="grid items-end gap-2 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3 sm:grid-cols-[1.3fr,1fr,1fr,1fr,1fr,auto]"
              >
                <Field label="Tipo">
                  <Select value={row.type} onChange={(event) => update(index, { type: event.target.value })}>
                    {Object.entries(MODIFIER_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="CA">
                  <Input
                    type="number"
                    className="text-center"
                    value={row.ac_bonus}
                    onChange={(event) => update(index, { ac_bonus: event.target.value })}
                  />
                </Field>
                <Field label="Resist.">
                  <Input
                    type="number"
                    className="text-center"
                    value={row.save_bonus}
                    onChange={(event) => update(index, { save_bonus: event.target.value })}
                  />
                </Field>
                <Field label="Atributo">
                  <Select value={row.ability} onChange={(event) => update(index, { ability: event.target.value })}>
                    <option value="">—</option>
                    {ABILITY_KEYS.map((key) => (
                      <option key={key} value={key}>{ABILITY_ABBR[key]}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Bônus">
                  <Input
                    type="number"
                    className="text-center"
                    value={row.value}
                    disabled={!row.ability}
                    onChange={(event) => update(index, { value: event.target.value })}
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    variant="danger"
                    size="xs"
                    type="button"
                    onClick={() => setRows((current) => current.filter((_, position) => position !== index))}
                  >
                    ×
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="ghost"
          size="xs"
          type="button"
          onClick={() =>
            setRows((current) => [
              ...current,
              { type: 'magic_item', ac_bonus: 0, save_bonus: 0, ability: '', value: 0 },
            ])
          }
        >
          + Adicionar modificador
        </Button>
      </div>
    </Modal>
  );
}

/** Aba Inventário: a caixa de seleção equipa/desequipa e recalcula a ficha na hora. */
export function InventoryTab({ character, sheet, inventory, onAdd, onUpdate, onRemove }) {
  const [picker, setPicker] = useState(false);
  const [modifierItem, setModifierItem] = useState(null);

  const equippedArmor = inventory.filter((item) => item.equipped && resolveItemKind(item) === 'armor');
  const totalWeight = inventory.length;
  const itemAcBonus = Number(sheet.itemModifiers?.acBonus) || 0;

  return (
    <div className="space-y-5">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.6fr),minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title={`Inventário (${totalWeight})`}
            subtitle="Marque a caixa ao lado do item para equipar: CA, atributos, resistências e ataques são recalculados na hora"
            action={<Button variant="primary" size="xs" onClick={() => setPicker(true)}>+ Adicionar</Button>}
          />
          <div className="space-y-2 p-4">
            {inventory.length === 0 ? (
              <p className="text-sm text-slate-500">Mochila vazia. Adicione armas, armaduras e itens.</p>
            ) : (
              inventory.map((item) => {
                const kind = resolveItemKind(item);
                const summary = itemSummary(item.catalog ?? {});
                const modifiers = modifiersSummary(item);
                return (
                  <div
                    key={item.id}
                    className={classNames(
                      'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                      item.equipped ? 'border-arcane-500/45 bg-arcane-500/5' : 'border-ink-700/70 bg-ink-900/50',
                    )}
                  >
                    <EquipCheckbox
                      checked={item.equipped}
                      title={item.equipped ? `Desequipar ${item.name}` : `Equipar ${item.name}`}
                      onChange={(checked) => onUpdate(item.id, { equipped: checked })}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-200">
                        {item.name}
                        {item.quantity > 1 ? <span className="ml-2 text-xs text-slate-500">×{item.quantity}</span> : null}
                        {item.equipped ? <Badge tone="arcane" className="ml-2">equipado</Badge> : null}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {KIND_LABELS[kind] ?? kind}
                        {summary ? ` — ${summary}` : ''}
                        {kind === 'weapon' && item.equipped ? ' · ataque disponível na aba Combate' : ''}
                        {item.notes ? ` · ${item.notes}` : ''}
                      </p>
                      {modifiers ? (
                        <p className="mt-0.5 truncate text-[11px] text-neon-300">
                          Modificadores: {modifiers}
                          {item.equipped ? '' : ' (aplique equipando)'}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setModifierItem(item)}
                        title="Editar os modificadores deste item"
                      >
                        Modificadores
                      </Button>
                      <Input
                        type="number"
                        min={0}
                        className="h-7 w-16 py-0 text-center"
                        defaultValue={item.quantity}
                        onBlur={(event) => onUpdate(item.id, { quantity: Number(event.target.value) || 0 })}
                        title="Quantidade"
                      />
                      <Button size="xs" variant="danger" onClick={() => onRemove(item.id)}>×</Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader title="Cálculo da CA" subtitle={sheet.armorClass.source} />
            <div className="space-y-2 p-4">
              <p className="font-display text-3xl text-arcane-200">{sheet.armorClass.total}</p>
              <ul className="space-y-1 text-xs text-slate-400">
                <li className="flex justify-between"><span>Base</span><span className="text-slate-200">{sheet.armorClass.base}</span></li>
                <li className="flex justify-between"><span>Escudo</span><span className="text-slate-200">+{sheet.armorClass.shieldBonus}</span></li>
                <li className="flex justify-between">
                  <span>Itens mágicos</span>
                  <span className="text-neon-300">{formatModifier(itemAcBonus)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Outros</span>
                  <span className="text-slate-200">+{sheet.armorClass.miscBonus - itemAcBonus}</span>
                </li>
              </ul>
              {equippedArmor.length > 1 ? (
                <Alert tone="warn">
                  Várias armaduras equipadas: vale a de maior categoria ({equippedArmor.length} no total).
                </Alert>
              ) : null}
              {sheet.armorClass.stealthDisadvantage ? (
                <Alert tone="warn">A armadura impõe desvantagem em Furtividade.</Alert>
              ) : null}
            </div>
          </Panel>

          {Object.keys(sheet.itemModifiers?.statBoost ?? {}).length > 0 ? (
            <Panel>
              <PanelHeader title="Bônus de itens ativos" subtitle="Somados aos atributos enquanto equipados" />
              <ul className="space-y-1 p-4 text-sm">
                {Object.entries(sheet.itemModifiers.statBoost).map(([key, value]) => (
                  <li key={key} className="flex justify-between">
                    <span className="text-slate-300">{ABILITY_ABBR[key] ?? key}</span>
                    <span className="text-neon-300">{formatModifier(value)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader title="Armas equipadas" subtitle="Role o ataque e o dano sem sair do inventário" />
            <div className="space-y-2 p-4 text-sm">
              {sheet.attacks.filter((attack) => attack.id !== 'unarmed-strike').length === 0 ? (
                <p className="text-slate-500">Nenhuma arma equipada.</p>
              ) : (
                sheet.attacks
                  .filter((attack) => attack.id !== 'unarmed-strike')
                  .map((attack) => (
                    <div key={attack.id} className="min-w-0 rounded-lg border border-ink-700/70 bg-ink-900/50 p-2.5">
                      <p className="truncate text-slate-300">{attack.name}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                      </div>
                    </div>
                  ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      <ItemPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={async (payload) => {
          await onAdd({ ...payload, quantity: 1, equipped: false });
          setPicker(false);
        }}
      />

      {modifierItem ? (
        <ModifierEditor
          item={modifierItem}
          open
          onClose={() => setModifierItem(null)}
          onSave={async (customData) => {
            await onUpdate(modifierItem.id, { customData });
            setModifierItem(null);
          }}
        />
      ) : null}
    </div>
  );
}
