import { Flame, Percent, Puzzle, Swords, Target, TrendingUp } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { RecentGames } from '@/components/home/RecentGames';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import {
  HEATMAP_HEIGHT_PX,
  Heatmap,
  HeatmapLegend,
  heatmapContentWidth,
} from '@/components/ui/Heatmap';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/lib/auth/store';
import { pickGreeting } from '@/lib/greetings';
import {
  HEATMAP_WEEKS,
  useGameStats,
  usePuzzleActivity,
  usePuzzleStats,
  useRecentGames,
} from '@/lib/hooks/useActivity';
import { humanMessage } from '@/lib/lichess/errors';

/** Padding orizzontale della Card (`p-5`), su entrambi i lati. */
const CARD_PADDING_X = 20;

/**
 * Larghezza della colonna delle heatmap, derivata dalla geometria reale della
 * griglia. Se cambia il numero di settimane o la dimensione delle celle, la
 * colonna si adatta da sola: nessun numero magico da tenere sincronizzato.
 */
const HEATMAP_COL_PX = heatmapContentWidth(HEATMAP_WEEKS) + CARD_PADDING_X * 2;

export function HomePage() {
  const status = useAuth((state) => state.status);
  const user = useAuth((state) => state.user);
  const authError = useAuth((state) => state.error);

  const gamesQuery = useRecentGames();
  const puzzlesQuery = usePuzzleActivity();

  const gameStats = useGameStats(gamesQuery.data, user?.id);
  const puzzleStats = usePuzzleStats(puzzlesQuery.data);

  const streakAtRisk = Boolean(
    gameStats && gameStats.calendar.streak.current > 0 && !gameStats.calendar.streak.activeToday,
  );

  const greeting = useMemo(() => pickGreeting({ streakAtRisk }), [streakAtRisk]);

  if (status === 'unknown' || status === 'loading') return <HomeSkeleton />;

  if (status === 'anonymous') return <SignedOutHome error={authError} />;

  return (
    <div className="animate-in space-y-6">
      <header>
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight md:text-[32px]">
          {greeting}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Bentornato, <span className="font-medium text-(--text-secondary)">{user?.username}</span>.
          {gameStats && gameStats.totalGames > 0 && (
            <> Hai giocato {gameStats.totalGames} partite negli ultimi mesi.</>
          )}
        </p>
      </header>

      {/* Riga di statistiche sintetiche */}
      <Card className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {gamesQuery.isPending ? (
          Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-14" />
            </div>
          ))
        ) : (
          <>
            <StatTile
              label="Streak partite"
              value={gameStats?.calendar.streak.current ?? 0}
              unit={gameStats?.calendar.streak.current === 1 ? 'giorno' : 'giorni'}
              tone="brand"
              icon={<Flame className="size-3.5" />}
              hint={
                streakAtRisk
                  ? 'Gioca oggi per non perderla'
                  : `Record: ${gameStats?.calendar.streak.longest ?? 0} giorni`
              }
            />
            <StatTile
              label="Win rate"
              value={gameStats?.winRate.winRate ?? 0}
              unit="%"
              icon={<Percent className="size-3.5" />}
              hint={
                gameStats
                  ? `${gameStats.winRate.wins}V · ${gameStats.winRate.draws}P · ${gameStats.winRate.losses}S`
                  : undefined
              }
            />
            <StatTile
              label="Streak puzzle"
              value={puzzleStats?.calendar.streak.current ?? 0}
              unit={puzzleStats?.calendar.streak.current === 1 ? 'giorno' : 'giorni'}
              tone="brand"
              icon={<Target className="size-3.5" />}
              hint={
                puzzleStats
                  ? `Record: ${puzzleStats.calendar.streak.longest} giorni`
                  : 'Nessun dato'
              }
            />
            <StatTile
              label="Rating"
              value={topRating(user?.perfs)?.rating ?? '—'}
              icon={<TrendingUp className="size-3.5" />}
              hint={topRating(user?.perfs)?.label}
            />
          </>
        )}
      </Card>

      {/* Due colonne: le heatmap a sinistra occupano esattamente la larghezza
          del loro contenuto, e lo spazio che avanza va alla lista partite
          invece di restare vuoto. */}
      <div
        className="grid gap-5 lg:grid-cols-[var(--heatmap-col)_minmax(0,1fr)]"
        style={{ '--heatmap-col': `${HEATMAP_COL_PX}px` } as CSSProperties}
      >
        <div className="min-w-0 space-y-5">
          {/* Heatmap partite */}
          <Card>
            <CardHeader
              title="Attività di gioco"
              subtitle={
                gameStats
                  ? `${gameStats.calendar.totalCount} partite · ${gameStats.calendar.streak.activeDays} giorni attivi`
                  : 'Ultimi mesi'
              }
            />
            {gamesQuery.isPending ? (
              <Skeleton className="w-full" style={{ height: `${HEATMAP_HEIGHT_PX}px` }} />
            ) : gamesQuery.isError ? (
              <ErrorState
                message={humanMessage(gamesQuery.error)}
                onRetry={() => void gamesQuery.refetch()}
              />
            ) : gameStats ? (
              <>
                <Heatmap calendar={gameStats.calendar} unit={{ one: 'partita', many: 'partite' }} />
                <HeatmapLegend className="mt-3 justify-end" />
              </>
            ) : null}
          </Card>

          {/* Heatmap puzzle */}
          <Card>
            <CardHeader
              title="Attività puzzle"
              subtitle={
                puzzleStats && puzzleStats.total > 0
                  ? `${puzzleStats.total} puzzle · ${puzzleStats.accuracy}% risolti`
                  : 'Ultimi mesi'
              }
              action={
                <Link
                  to="/puzzle"
                  className="text-[13px] font-medium text-brand-400 hover:text-brand-300"
                >
                  Allenati
                </Link>
              }
            />
            {puzzlesQuery.isPending ? (
              <Skeleton className="w-full" style={{ height: `${HEATMAP_HEIGHT_PX}px` }} />
            ) : puzzlesQuery.isError ? (
              <ErrorState
                message={humanMessage(puzzlesQuery.error)}
                onRetry={() => void puzzlesQuery.refetch()}
              />
            ) : puzzleStats && puzzleStats.total > 0 ? (
              <>
                <Heatmap calendar={puzzleStats.calendar} unit={{ one: 'puzzle', many: 'puzzle' }} />
                <p className="mt-3 text-right text-[12px] text-muted">
                  rating medio <span className="tnum">{puzzleStats.averageRating}</span>
                </p>
              </>
            ) : (
              <EmptyState
                compact
                icon={<Puzzle className="size-5" />}
                title="Nessun puzzle risolto"
                description="Risolvi il primo e la griglia inizierà a riempirsi."
                action={
                  <Link to="/puzzle">
                    <Button size="sm" variant="secondary">
                      Vai ai puzzle
                    </Button>
                  </Link>
                }
              />
            )}
          </Card>
        </div>

        {/* Ultime partite: prende tutta l'altezza per allinearsi alla colonna
            di sinistra invece di lasciare un gradino. */}
        <Card className="lg:h-full">
          <CardHeader
            title="Ultime partite"
            subtitle="Le tue 5 partite più recenti"
            action={
              <Link
                to="/archivio"
                className="text-[13px] font-medium text-brand-400 hover:text-brand-300"
              >
                Archivio
              </Link>
            }
          />
          {gamesQuery.isError ? (
            <ErrorState
              message={humanMessage(gamesQuery.error)}
              onRetry={() => void gamesQuery.refetch()}
            />
          ) : (
            <RecentGames
              games={gameStats?.recent ?? []}
              userId={user?.id ?? ''}
              loading={gamesQuery.isPending}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

/** Il perf con più partite giocate: il rating che rappresenta l'utente. */
function topRating(
  perfs: Record<string, { games: number; rating: number } | undefined> | undefined,
): { rating: number; label: string } | null {
  if (!perfs) return null;

  const RELEVANT = ['bullet', 'blitz', 'rapid', 'classical'];
  let best: { rating: number; label: string; games: number } | null = null;

  for (const key of RELEVANT) {
    const perf = perfs[key];
    if (!perf || perf.games === 0) continue;
    if (!best || perf.games > best.games) {
      best = { rating: perf.rating, label: LABELS[key] ?? key, games: perf.games };
    }
  }

  return best ? { rating: best.rating, label: best.label } : null;
}

const LABELS: Record<string, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classica',
};

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-[320px] max-w-full" />
        <Skeleton className="h-4 w-[220px]" />
      </div>
      <Skeleton className="h-[104px] w-full rounded-[14px]" />
      <Skeleton className="h-[190px] w-full rounded-[14px]" />
      <Skeleton className="h-[190px] w-full rounded-[14px]" />
    </div>
  );
}

function SignedOutHome({ error }: { error: string | null }) {
  const login = useAuth((state) => state.login);

  return (
    <div className="animate-in mx-auto flex max-w-lg flex-col items-center gap-6 py-12 text-center">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight md:text-[34px]">
          Pronto a dare <span className="brand-gradient-text">scacco matto</span>?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          Arrocco è un client moderno per Lichess. Collega il tuo account per giocare, allenarti
          con i puzzle e seguire i tuoi progressi.
        </p>
      </div>

      {error && (
        <div className="w-full rounded-[10px] border border-(--color-loss)/25 bg-(--color-loss)/8 px-4 py-3 text-left">
          <p className="text-[13px] leading-relaxed text-(--color-loss)">{error}</p>
        </div>
      )}

      <Button size="lg" onClick={() => void login()} icon={<Swords className="size-4" />}>
        Accedi con Lichess
      </Button>

      <div className="space-y-3">
        <div className="flex flex-wrap justify-center gap-2">
          <Badge tone="brand">Nessun dato lascia il tuo browser</Badge>
          <Badge>OAuth ufficiale Lichess</Badge>
        </div>
        <p className="max-w-md text-[12.5px] leading-relaxed text-muted">
          Arrocco parla direttamente con le API di Lichess: non c'è nessun server intermedio, e il
          tuo token resta salvato solo su questo dispositivo.
        </p>
      </div>
    </div>
  );
}
