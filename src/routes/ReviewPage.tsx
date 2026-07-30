import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Repeat,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Board } from '@/components/chess/Board';
import { MoveList, moveCountLabel, type MoveMark } from '@/components/chess/MoveList';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/lib/auth/store';
import { replaySanMoves } from '@/lib/chess/rules';
import { cn } from '@/lib/cn';
import { fetchGame } from '@/lib/lichess/api';
import { LICHESS_ORIGIN } from '@/lib/lichess/config';
import { humanMessage } from '@/lib/lichess/errors';
import type { Color, GameExport, GameExportPlayer, MoveAnalysis } from '@/lib/lichess/types';
import { gameQueryKeys } from '@/lib/queryKeys';
import {
  formatEval,
  judgmentLabel,
  judgmentMark,
  whiteAdvantagePercent,
} from '@/lib/stats/evaluation';
import { colorOf, speedLabel, statusLabel, timeControlLabel } from '@/lib/stats/games';

export function ReviewPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const userId = useAuth((state) => state.user?.id);

  const query = useQuery({
    queryKey: gameQueryKeys.detail(gameId),
    enabled: Boolean(gameId),
    queryFn: ({ signal }) => fetchGame(gameId as string, signal),
    // Una partita conclusa non cambia più, salvo l'aggiunta dell'analisi.
    staleTime: 10 * 60_000,
  });

  if (!gameId) return null;

  return (
    <div className="animate-in space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/archivio"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-(--text-primary)"
        >
          <ArrowLeft className="size-4" />
          Archivio
        </Link>
        <a
          href={`${LICHESS_ORIGIN}/${gameId}`}
          target="_blank"
          rel="noreferrer noopener"
          title="Apri su Lichess"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-(--surface-raised) hover:text-(--text-primary)"
        >
          Apri su Lichess
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {query.isPending ? (
        <ReviewSkeleton />
      ) : query.isError ? (
        <ErrorState message={humanMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <Review game={query.data} userId={userId ?? ''} />
      )}
    </div>
  );
}

function Review({ game, userId }: { game: GameExport; userId: string }) {
  const positions = useMemo(
    () => replaySanMoves(game.moves ?? '', game.initialFen),
    [game.moves, game.initialFen],
  );

  const sanMoves = useMemo(
    () => positions.slice(1).map((position) => position.san ?? ''),
    [positions],
  );

  /**
   * `analysis[i]` giudica la mossa `i`, cioè descrive la posizione di ply
   * `i + 1`: l'allineamento con la lista mosse è quindi diretto, mentre verso
   * le posizioni è sfalsato di uno.
   */
  const marks = useMemo<(MoveMark | undefined)[]>(
    () =>
      sanMoves.map((_san, index) => {
        const judgment = game.analysis?.[index]?.judgment;
        return judgment ? judgmentMark(judgment.name) : undefined;
      }),
    [game.analysis, sanMoves],
  );

  const lastPly = positions.length - 1;
  const [ply, setPly] = useState(lastPly);
  const [flipped, setFlipped] = useState(false);

  const goTo = useCallback(
    (target: number) => setPly(Math.max(0, Math.min(lastPly, target))),
    [lastPly],
  );

  // Le frecce sono il modo naturale di sfogliare una partita. Restano inattive
  // mentre si scrive in un campo, per non rubare i tasti a un input futuro.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case 'ArrowLeft':
          setPly((current) => Math.max(0, current - 1));
          break;
        case 'ArrowRight':
          setPly((current) => Math.min(lastPly, current + 1));
          break;
        case 'ArrowUp':
        case 'Home':
          setPly(0);
          break;
        case 'ArrowDown':
        case 'End':
          setPly(lastPly);
          break;
        default:
          return;
      }
      // Solo i tasti gestiti annullano lo scroll della pagina.
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lastPly]);

  const myColor = colorOf(game, userId);
  const baseOrientation: Color = myColor ?? 'white';
  const orientation: Color = flipped
    ? baseOrientation === 'white'
      ? 'black'
      : 'white'
    : baseOrientation;

  const position = positions[ply];
  // La posizione di ply N è descritta dalla voce di analisi N-1, cioè quella
  // della mossa che ci ha portati qui.
  const evaluation = ply > 0 ? game.analysis?.[ply - 1] : undefined;
  const judgment = evaluation?.judgment;

  /**
   * Valutazione per la barra, che non coincide sempre con quella della mossa.
   *
   * L'array `analysis` è più corto delle mosse di una voce: la posizione dopo
   * il matto non viene valutata, e la barra si troverebbe al 50% neutro
   * esattamente nel momento meno neutro della partita. Lì usiamo il risultato;
   * altrove, se una voce manca, teniamo l'ultima valutazione nota invece di
   * azzerare il vantaggio.
   */
  const barEntry = useMemo<MoveAnalysis | undefined>(() => {
    if (!game.analysis?.length) return undefined;

    if (ply === lastPly && game.status === 'mate' && game.winner) {
      return { mate: game.winner === 'white' ? 1 : -1 };
    }

    for (let index = ply - 1; index >= 0; index -= 1) {
      const entry = game.analysis[index];
      if (entry && (entry.eval !== undefined || entry.mate !== undefined)) return entry;
    }
    return undefined;
  }, [game.analysis, game.status, game.winner, ply, lastPly]);

  const topColor: Color = orientation === 'white' ? 'black' : 'white';
  const bottomColor: Color = orientation === 'white' ? 'white' : 'black';

  if (!position) {
    return <ErrorState message="Non è stato possibile ricostruire la partita." />;
  }

  const hasAnalysis = Boolean(game.analysis?.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-2.5">
        <PlayerRow player={game.players[topColor]} color={topColor} isSelf={topColor === myColor} />

        <div className="flex gap-2.5">
          {hasAnalysis && <EvalBar entry={barEntry} orientation={orientation} />}
          <Board
            className="min-w-0 flex-1"
            fen={position.fen}
            orientation={orientation}
            lastMove={position.lastMove}
            check={position.check}
            viewOnly
            animate
          />
        </div>

        <PlayerRow
          player={game.players[bottomColor]}
          color={bottomColor}
          isSelf={bottomColor === myColor}
        />

        <Controls
          ply={ply}
          lastPly={lastPly}
          onGoTo={goTo}
          onFlip={() => setFlipped((value) => !value)}
        />
      </div>

      <div className="space-y-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {statusLabel(game.status, game.winner)}
                {game.winner && (
                  <span className="text-muted">
                    {' · '}
                    {game.winner === 'white' ? 'vince il bianco' : 'vince il nero'}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {speedLabel(game.speed)} · {timeControlLabel(game)}
                {game.rated ? ' · valutata' : ' · amichevole'}
              </p>
            </div>
            {game.rated && <Badge tone="brand">rated</Badge>}
          </div>
          {game.opening && (
            <p className="mt-3 border-t border-(--border-subtle) pt-3 text-[12.5px] text-secondary">
              <span className="tnum text-muted">{game.opening.eco}</span> {game.opening.name}
            </p>
          )}
        </Card>

        {hasAnalysis ? (
          <AccuracyCard game={game} />
        ) : (
          <Card>
            <p className="text-[13px] leading-relaxed text-muted">
              Questa partita non ha ancora l'analisi del computer. Puoi richiederla su Lichess: da
              quel momento comparirà anche qui.
            </p>
          </Card>
        )}

        {judgment && (
          <Card className="border-(--border-strong)">
            <p className="text-[13px] font-semibold">{judgmentLabel(judgment.name)}</p>
            {evaluation?.variation && (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-secondary">
                Migliore:{' '}
                <span className="font-medium text-(--text-primary)">
                  {firstMoveOf(evaluation.variation)}
                </span>
                <span className="text-muted"> — {evaluation.variation}</span>
              </p>
            )}
          </Card>
        )}

        <Card>
          <CardHeader
            title="Mosse"
            subtitle={moveCountLabel(sanMoves.length)}
          />
          <MoveList sanMoves={sanMoves} currentPly={ply} onSelect={goTo} marks={marks} />
        </Card>
      </div>
    </div>
  );
}

/** Barra di valutazione verticale: il bianco riempie dal basso. */
function EvalBar({
  entry,
  orientation,
}: {
  entry: MoveAnalysis | undefined;
  orientation: Color;
}) {
  const whitePercent = whiteAdvantagePercent(entry);
  const label = formatEval(entry);
  // Con la scacchiera girata anche la barra va capovolta, altrimenti il
  // vantaggio finirebbe dalla parte sbagliata rispetto ai pezzi.
  const fillPercent = orientation === 'white' ? whitePercent : 100 - whitePercent;

  return (
    <div
      className="relative w-3 shrink-0 self-stretch overflow-hidden rounded-full bg-ink-900"
      title={label ?? 'Nessuna valutazione'}
      aria-label={label ? `Valutazione ${label}` : 'Valutazione non disponibile'}
    >
      <div
        className="absolute inset-x-0 bottom-0 bg-white transition-[height] duration-200"
        style={{ height: `${fillPercent}%` }}
      />
    </div>
  );
}

function Controls({
  ply,
  lastPly,
  onGoTo,
  onFlip,
}: {
  ply: number;
  lastPly: number;
  onGoTo: (target: number) => void;
  onFlip: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <NavButton label="Inizio" onClick={() => onGoTo(0)} disabled={ply === 0}>
        <ChevronFirst className="size-4" />
      </NavButton>
      <NavButton label="Indietro" onClick={() => onGoTo(ply - 1)} disabled={ply === 0}>
        <ChevronLeft className="size-4" />
      </NavButton>
      <NavButton label="Avanti" onClick={() => onGoTo(ply + 1)} disabled={ply === lastPly}>
        <ChevronRight className="size-4" />
      </NavButton>
      <NavButton label="Fine" onClick={() => onGoTo(lastPly)} disabled={ply === lastPly}>
        <ChevronLast className="size-4" />
      </NavButton>

      <span className="tnum ml-1 text-[12px] text-muted">
        {ply} / {lastPly}
      </span>

      <NavButton label="Ruota la scacchiera" onClick={onFlip} className="ml-auto">
        <Repeat className="size-4" />
      </NavButton>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  disabled = false,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'rounded-lg p-1.5 text-muted transition-colors',
        'hover:bg-(--surface-raised) hover:text-(--text-primary)',
        'disabled:pointer-events-none disabled:opacity-35',
        className,
      )}
    >
      {children}
    </button>
  );
}

function AccuracyCard({ game }: { game: GameExport }) {
  const rows: Array<{ color: Color; label: string; player: GameExportPlayer }> = [
    { color: 'white', label: 'Bianco', player: game.players.white },
    { color: 'black', label: 'Nero', player: game.players.black },
  ];

  return (
    <Card>
      <CardHeader title="Analisi" subtitle="Calcolata da Lichess" />
      <div className="space-y-3">
        {rows.map(({ color, label, player }) => {
          const analysis = player.analysis;
          return (
            <div key={color}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2.5 rounded-full border',
                      color === 'white'
                        ? 'border-(--border-strong) bg-white'
                        : 'border-ink-700 bg-ink-900',
                    )}
                  />
                  {player.user?.name ?? label}
                </span>
                {analysis?.accuracy !== undefined && (
                  <span className="tnum text-[13px] font-semibold text-brand-400">
                    {analysis.accuracy}%
                  </span>
                )}
              </div>
              {analysis && (
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted">
                  <Count value={analysis.inaccuracy} one="imprecisione" many="imprecisioni" />
                  <Count value={analysis.mistake} one="errore" many="errori" />
                  <Count value={analysis.blunder} one="svista" many="sviste" />
                  <span>
                    ACPL <span className="tnum">{analysis.acpl}</span>
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PlayerRow({
  player,
  color,
  isSelf,
}: {
  player: GameExportPlayer;
  color: Color;
  isSelf: boolean;
}) {
  const name =
    player.aiLevel !== undefined
      ? `Stockfish livello ${player.aiLevel}`
      : (player.user?.name ?? 'Anonimo');

  return (
    <div className="flex items-center justify-between gap-3 px-0.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'size-3 shrink-0 rounded-full border',
            color === 'white' ? 'border-(--border-strong) bg-white' : 'border-ink-700 bg-ink-900',
          )}
        />
        <span className="truncate text-sm font-medium">{name}</span>
        {player.rating !== undefined && (
          <span className="tnum text-[12px] text-muted">{player.rating}</span>
        )}
        {player.ratingDiff !== undefined && player.ratingDiff !== 0 && (
          <span
            className={cn(
              'tnum text-[12px] font-medium',
              player.ratingDiff > 0 ? 'text-(--color-win)' : 'text-(--color-loss)',
            )}
          >
            {player.ratingDiff > 0 ? '+' : ''}
            {player.ratingDiff}
          </span>
        )}
        {isSelf && <Badge tone="brand">tu</Badge>}
      </div>
    </div>
  );
}

/** Conteggio con il sostantivo al numero giusto: "1 svista", "4 sviste". */
function Count({ value, one, many }: { value: number; one: string; many: string }) {
  return (
    <span>
      <span className="tnum">{value}</span> {value === 1 ? one : many}
    </span>
  );
}

/** Prima mossa di una variante SAN, cioè quella che si sarebbe dovuta giocare. */
function firstMoveOf(variation: string): string {
  return variation.trim().split(/\s+/)[0] ?? '';
}

function ReviewSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-[92px] rounded-[14px]" />
        <Skeleton className="h-[140px] rounded-[14px]" />
        <Skeleton className="h-[280px] rounded-[14px]" />
      </div>
    </div>
  );
}
