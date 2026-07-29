import { useInfiniteQuery } from '@tanstack/react-query';
import { Archive, LogIn } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatRelative } from '@/components/home/RecentGames';
import { Badge, OutcomeChip } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/lib/auth/store';
import { cn } from '@/lib/cn';
import { exportGames } from '@/lib/lichess/api';
import { LICHESS_ORIGIN } from '@/lib/lichess/config';
import { humanMessage } from '@/lib/lichess/errors';
import type { ExportedGame } from '@/lib/lichess/types';
import {
  colorOf,
  opponentLabel,
  opponentRating,
  outcomeOf,
  ratingDiffOf,
  speedLabel,
  statusLabel,
  summarizeWinRate,
  timeControlLabel,
} from '@/lib/stats/games';

const PAGE_SIZE = 50;

type OutcomeFilter = 'all' | 'win' | 'loss' | 'draw';

export function ArchivePage() {
  const status = useAuth((state) => state.status);
  const user = useAuth((state) => state.user);
  const login = useAuth((state) => state.login);

  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [speedFilter, setSpeedFilter] = useState<string>('all');

  /**
   * Paginazione a cursore sul timestamp.
   *
   * L'API non offre offset: si scorre indietro nel tempo passando `until` con
   * il `createdAt` della partita più vecchia già ricevuta. Sottraiamo 1 ms per
   * non ricevere di nuovo quella stessa partita.
   */
  const query = useInfiniteQuery({
    queryKey: ['games', 'archive', user?.username],
    enabled: status === 'authenticated' && Boolean(user?.username),
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam, signal }) =>
      exportGames({
        username: user?.username as string,
        max: PAGE_SIZE,
        until: pageParam,
        withMoves: false,
        withOpening: true,
        signal,
      }),
    getNextPageParam: (lastPage: ExportedGame[]) => {
      // Una pagina più corta del richiesto significa che siamo alla fine.
      if (lastPage.length < PAGE_SIZE) return undefined;
      const oldest = lastPage[lastPage.length - 1];
      return oldest ? oldest.createdAt - 1 : undefined;
    },
    staleTime: 5 * 60_000,
  });

  const allGames = useMemo(
    () => query.data?.pages.flat() ?? [],
    [query.data],
  );

  const filtered = useMemo(() => {
    const userId = user?.id ?? '';
    return allGames.filter((game) => {
      if (speedFilter !== 'all' && game.speed !== speedFilter) return false;
      if (outcomeFilter !== 'all' && outcomeOf(game, userId) !== outcomeFilter) return false;
      return true;
    });
  }, [allGames, outcomeFilter, speedFilter, user?.id]);

  const summary = useMemo(
    () => summarizeWinRate(allGames, user?.id ?? ''),
    [allGames, user?.id],
  );

  const availableSpeeds = useMemo(() => {
    const speeds = new Set(allGames.map((game) => game.speed));
    return [...speeds];
  }, [allGames]);

  if (status !== 'authenticated') {
    return (
      <div className="animate-in">
        <Header />
        <Card className="mt-6">
          <EmptyState
            icon={<LogIn className="size-5" />}
            title="Accedi per vedere il tuo archivio"
            description="Lo storico partite viene letto direttamente dal tuo account Lichess."
            action={<Button onClick={() => void login()}>Accedi con Lichess</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-in space-y-5">
      <Header />

      <Card className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        <StatTile label="Partite caricate" value={allGames.length} />
        <StatTile label="Vittorie" value={summary.wins} tone="win" />
        <StatTile label="Sconfitte" value={summary.losses} tone="loss" />
        <StatTile label="Win rate" value={summary.winRate} unit="%" tone="brand" />
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-(--border-subtle) px-5 py-3.5">
          <FilterGroup
            label="Esito"
            options={[
              { value: 'all', label: 'Tutti' },
              { value: 'win', label: 'Vittorie' },
              { value: 'draw', label: 'Patte' },
              { value: 'loss', label: 'Sconfitte' },
            ]}
            value={outcomeFilter}
            onChange={(value) => setOutcomeFilter(value as OutcomeFilter)}
          />

          {availableSpeeds.length > 1 && (
            <FilterGroup
              label="Cadenza"
              options={[
                { value: 'all', label: 'Tutte' },
                ...availableSpeeds.map((speed) => ({
                  value: speed,
                  label: speedLabel(speed),
                })),
              ]}
              value={speedFilter}
              onChange={setSpeedFilter}
            />
          )}
        </div>

        {query.isError ? (
          <ErrorState
            className="m-5"
            message={humanMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : query.isPending ? (
          <div className="space-y-1 p-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 px-2 py-2.5">
                <Skeleton className="size-6 rounded-md" />
                <Skeleton className="h-4 flex-1" style={{ maxWidth: '200px' }} />
                <Skeleton className="ml-auto h-3 w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Archive className="size-5" />}
            title={
              allGames.length === 0 ? 'Nessuna partita nell’archivio' : 'Nessun risultato'
            }
            description={
              allGames.length === 0
                ? 'Le partite che giocherai su Lichess appariranno qui.'
                : 'Nessuna partita corrisponde ai filtri selezionati.'
            }
          />
        ) : (
          <ul className="divide-y divide-(--border-subtle)">
            {filtered.map((game) => (
              <ArchiveRow key={game.id} game={game} userId={user?.id ?? ''} />
            ))}
          </ul>
        )}

        {query.hasNextPage && (
          <div className="border-t border-(--border-subtle) p-4 text-center">
            <Button
              variant="secondary"
              size="sm"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Carica altre {PAGE_SIZE} partite
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function Header() {
  return (
    <header>
      <h1 className="text-[24px] leading-tight font-semibold tracking-tight md:text-[28px]">
        Archivio
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Tutte le tue partite, dalla più recente. I filtri agiscono sulle partite già caricate.
      </p>
    </header>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</span>
      <div className="flex gap-0.5 rounded-lg bg-(--surface-sunken) p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'rounded-md px-2 py-1 text-[12px] font-medium transition-colors',
              value === option.value
                ? 'bg-(--surface-raised) text-brand-400 shadow-sm'
                : 'text-muted hover:text-(--text-primary)',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ArchiveRow({ game, userId }: { game: ExportedGame; userId: string }) {
  const outcome = outcomeOf(game, userId);
  const diff = ratingDiffOf(game, userId);
  const rating = opponentRating(game, userId);
  const color = colorOf(game, userId);

  return (
    <li>
      <a
        href={`${LICHESS_ORIGIN}/${game.id}`}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-(--surface-raised)"
      >
        <OutcomeChip outcome={outcome} />

        <span
          aria-label={color === 'white' ? 'Hai giocato con il bianco' : 'Hai giocato con il nero'}
          title={color === 'white' ? 'Bianco' : 'Nero'}
          className={cn(
            'size-2.5 shrink-0 rounded-full border',
            color === 'white' ? 'border-(--border-strong) bg-white' : 'border-ink-700 bg-ink-900',
          )}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium">
              {opponentLabel(game, userId)}
            </span>
            {rating !== null && <span className="tnum text-[12px] text-muted">{rating}</span>}
            {game.rated && <Badge>valutata</Badge>}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {statusLabel(game.status, game.winner)}
            {game.opening && ` · ${game.opening.name}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="tnum hidden text-[12px] text-muted sm:inline">
            {timeControlLabel(game)}
          </span>
          {diff !== null && diff !== 0 && (
            <span
              className={cn(
                'tnum w-8 text-right text-[12px] font-medium',
                diff > 0 ? 'text-(--color-win)' : 'text-(--color-loss)',
              )}
            >
              {diff > 0 ? '+' : ''}
              {diff}
            </span>
          )}
          <span className="tnum w-14 text-right text-[12px] text-muted">
            {formatRelative(game.createdAt)}
          </span>
        </div>
      </a>
    </li>
  );
}
