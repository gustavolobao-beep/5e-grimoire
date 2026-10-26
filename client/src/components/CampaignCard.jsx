import { Link } from 'react-router-dom';
import { Badge } from './ui.jsx';

/** Card de campanha (Mestre ou jogador). */
export function CampaignCard({ campaign }) {
  const isDm = campaign.role === 'dm';
  return (
    <Link
      to={`/campanhas/${campaign.id}`}
      className="panel group flex flex-col gap-2 p-4 transition-all hover:border-arcane-500/60 hover:shadow-glow"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base text-slate-100 group-hover:text-white">{campaign.name}</h3>
        <Badge tone={isDm ? 'arcane' : 'neon'}>{isDm ? 'Mestre' : 'Jogador'}</Badge>
      </div>

      {campaign.description ? (
        <p className="line-clamp-2 text-xs text-slate-400">{campaign.description}</p>
      ) : (
        <p className="text-xs text-slate-500">Sem sinopse.</p>
      )}

      <div className="mt-auto flex items-center justify-between pt-2 text-xs text-slate-500">
        {isDm ? (
          <span>
            {campaign.memberCount} {campaign.memberCount === 1 ? 'jogador' : 'jogadores'} vinculados
          </span>
        ) : (
          <span>Como {campaign.characterName ?? '—'}</span>
        )}
        {campaign.status && campaign.status !== 'active' ? (
          <Badge tone="gold">{campaign.status === 'paused' ? 'pausada' : 'encerrada'}</Badge>
        ) : null}
      </div>
    </Link>
  );
}
