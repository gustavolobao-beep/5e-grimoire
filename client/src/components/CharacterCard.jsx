import { Link } from 'react-router-dom';
import { formatRelativeDate } from '../lib/format.js';
import { Avatar, Badge, HealthBar } from './ui.jsx';

/** Card de ficha usado no painel e na lista de personagens. */
export function CharacterCard({ character }) {
  return (
    <Link
      to={`/personagens/${character.id}`}
      className="panel group flex flex-col gap-3 p-4 transition-all hover:border-arcane-500/60 hover:shadow-glow"
    >
      <div className="flex items-center gap-3">
        <Avatar name={character.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base text-slate-100 group-hover:text-white">{character.name}</h3>
          <p className="truncate text-xs text-slate-400">{character.classes || 'Sem classe'} · nível {character.level}</p>
        </div>
        {character.isUnconscious ? <Badge tone="ember">Inconsciente</Badge> : null}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            PV <span className="text-slate-200">{character.hpCurrent}</span>/{character.hpMax}
            {character.hpTemp > 0 ? <span className="text-neon-300"> +{character.hpTemp}</span> : null}
          </span>
          <span className="text-slate-500">{formatRelativeDate(character.updatedAt)}</span>
        </div>
        <HealthBar current={character.hpCurrent} max={character.hpMax} temp={character.hpTemp} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-ink-700/70 bg-ink-900/60 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">CA</p>
          <p className="font-display text-sm text-arcane-200">{character.armorClass}</p>
        </div>
        <div className="rounded-lg border border-ink-700/70 bg-ink-900/60 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Iniciativa</p>
          <p className="font-display text-sm text-slate-100">{character.initiative >= 0 ? `+${character.initiative}` : character.initiative}</p>
        </div>
        <div className="rounded-lg border border-ink-700/70 bg-ink-900/60 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">P. Passiva</p>
          <p className="font-display text-sm text-slate-100">{character.passivePerception}</p>
        </div>
      </div>
    </Link>
  );
}
