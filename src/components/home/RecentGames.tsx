import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OutcomeChip } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { LICHESS_ORIGIN } from '@/lib/lichess/config';
import type { ExportedGame } from '@/lib/lichess/types';
import {
  opponentLabel,
  opponentRating,
  outcomeOf,
  ratingDiffOf,
  statusLabel,
  timeControlLabel,
} from '@/lib/stats/games';

interface RecentGamesProps {
  games: ExportedGame[];
  userId: string;
  loading?: boolean;
}

export function RecentGames({ games, userId, loading = false }: RecentGamesProps) {
  if (loading) {
    return (
      <ul className="space-y-1">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="flex items-center gap-3 px-1 py-2.5">
            <Skeleton className="size-6 rounded-md" />
            <Skeleton className="h-4 flex-1" style={{ maxWidth: '160px' }} />
            <Skeleton className="ml-auto h-3 w-14" />
          </li>
        ))}
      </ul>
    );
  }

  if (games.length === 0) {
    return (
      <EmptyState
        title="Nessuna partita recente"
        description="Le partite che giocherai su Lichess appariranno qui."
        action={
          <Link
            to="/gioca"
            className="text-[13px] font-medium text-brand-400 hover:text-brand-300"
          >
            Gioca la prima →
          </Link>
        }
      />
    );
  }

  return (
    <ul className="-mx-1.5">
      {games.map((game) => (
        <GameRow key={game.id} game={game} userId={userId} />
      ))}
    </ul>
  );
}

function GameRow({ game, userId }: { game: ExportedGame; userId: string }) {
  const outcome = outcomeOf(game, userId);
  const diff = ratingDiffOf(game, userId);
  const rating = opponentRating(game, userId);

  return (
    <li>
      {/* L'analisi completa vive su Lichess: invece di reimplementarla, la
          apriamo là. È anche il comportamento che un utente Lichess si aspetta. */}
      <a
        href={`${LICHESS_ORIGIN}/${game.id}`}
        target="_blank"
        rel="noreferrer noopener"
        className="group flex items-center gap-3 rounded-[10px] px-1.5 py-2.5 transition-colors hover:bg-(--surface-raised)"
      >
        <OutcomeChip outcome={outcome} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium text-(--text-primary)">
              {opponentLabel(game, userId)}
            </span>
            {rating !== null && <span className="tnum text-[12px] text-muted">{rating}</span>}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {timeControlLabel(game)} · {statusLabel(game.status, game.winner)}
            {game.opening && ` · ${game.opening.name}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {diff !== null && diff !== 0 && (
            <span
              className={cn(
                'tnum text-[12px] font-medium',
                diff > 0 ? 'text-(--color-win)' : 'text-(--color-loss)',
              )}
            >
              {diff > 0 ? '+' : ''}
              {diff}
            </span>
          )}
          <span className="tnum hidden text-[12px] text-muted sm:inline">
            {formatRelative(game.createdAt)}
          </span>
          <ExternalLink className="size-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </a>
    </li>
  );
}

/** Data relativa compatta in italiano: "3 h", "ieri", "12 mar". */
export function formatRelative(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return 'ora';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days} g`;

  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: '2-digit' }),
  });
}
