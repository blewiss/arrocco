import {
  ArrowLeft,
  ExternalLink,
  Flag,
  Handshake,
  RefreshCw,
  Repeat,
  Trophy,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Key } from 'chessground/types';
import { Board } from '@/components/chess/Board';
import { Clock } from '@/components/chess/Clock';
import { MoveList, moveCountLabel } from '@/components/chess/MoveList';
import { PromotionPicker, type PromotionPiece } from '@/components/chess/PromotionPicker';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/lib/auth/store';
import { isPromotion, moveToUci } from '@/lib/chess/rules';
import { cn } from '@/lib/cn';
import { abortGame, claimVictory, handleDraw, resignGame } from '@/lib/lichess/api';
import { LICHESS_ORIGIN } from '@/lib/lichess/config';
import { humanMessage } from '@/lib/lichess/errors';
import type { Color, GameFullPlayer } from '@/lib/lichess/types';
import { useLiveGame, useTickingClock } from '@/lib/hooks/useLiveGame';
import { statusLabel } from '@/lib/stats/games';

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const userId = useAuth((state) => state.user?.id);

  const game = useLiveGame(gameId, userId);
  const clock = useTickingClock(game);

  const [pendingPromotion, setPendingPromotion] = useState<{ from: Key; to: Key } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  const orientation: Color = flipped
    ? game.myColor === 'black'
      ? 'white'
      : 'black'
    : (game.myColor ?? 'white');

  const submitMove = useCallback(
    async (uci: string) => {
      setActionError(null);
      try {
        await game.sendMove(uci);
      } catch (error) {
        setActionError(humanMessage(error));
      }
    },
    [game],
  );

  const handleMove = useCallback(
    (from: Key, to: Key) => {
      // La promozione richiede di sapere quale pezzo prima di poter comporre
      // l'UCI: intercettiamo la mossa e chiediamo all'utente.
      if (isPromotion(game.chess, from, to)) {
        setPendingPromotion({ from, to });
        return;
      }
      void submitMove(moveToUci({ from, to }));
    },
    [game.chess, submitMove],
  );

  const runAction = useCallback(
    async (name: string, action: () => Promise<unknown>) => {
      setBusyAction(name);
      setActionError(null);
      try {
        await action();
      } catch (error) {
        setActionError(humanMessage(error));
      } finally {
        setBusyAction(null);
      }
    },
    [],
  );

  if (!gameId) return null;

  if (game.connection === 'error') {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState message={game.error ?? 'Impossibile seguire la partita.'} />
      </div>
    );
  }

  if (!game.full) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-[300px] rounded-[14px]" />
        </div>
      </div>
    );
  }

  const topPlayer = orientation === 'white' ? game.full.black : game.full.white;
  const bottomPlayer = orientation === 'white' ? game.full.white : game.full.black;
  const topColor: Color = orientation === 'white' ? 'black' : 'white';
  const bottomColor: Color = orientation === 'white' ? 'white' : 'black';

  const canAbort = game.ply < 2 && !game.finished;
  const drawOffered = game.myColor
    ? game.myColor === 'white'
      ? game.state?.bdraw
      : game.state?.wdraw
    : false;

  return (
    <div className="animate-in space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BackLink />
        <div className="flex items-center gap-2">
          <Badge tone={game.finished ? 'neutral' : 'brand'}>
            {game.finished ? 'Conclusa' : game.connection === 'live' ? 'In corso' : 'Connessione…'}
          </Badge>
          <a
            href={`${LICHESS_ORIGIN}/${gameId}`}
            target="_blank"
            rel="noreferrer noopener"
            title="Apri su Lichess"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-(--surface-raised) hover:text-(--text-primary)"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-2.5">
          <PlayerRow
            player={topPlayer}
            color={topColor}
            clockMs={clock ? clock[topColor] : null}
            active={clock?.running === topColor}
          />

          <div className="relative">
            <Board
              fen={game.fen}
              orientation={orientation}
              turnColor={game.turn}
              lastMove={game.lastMove}
              check={game.check}
              movableColor={game.myTurn ? (game.myColor ?? undefined) : undefined}
              dests={game.dests}
              revision={game.revision}
              onMove={handleMove}
              premovable={!game.finished}
            />
            {pendingPromotion && game.myColor && (
              <PromotionPicker
                color={game.myColor}
                onCancel={() => setPendingPromotion(null)}
                onSelect={(piece: PromotionPiece) => {
                  const { from, to } = pendingPromotion;
                  setPendingPromotion(null);
                  void submitMove(moveToUci({ from, to, promotion: piece }));
                }}
              />
            )}
          </div>

          <PlayerRow
            player={bottomPlayer}
            color={bottomColor}
            clockMs={clock ? clock[bottomColor] : null}
            active={clock?.running === bottomColor}
            isSelf={bottomColor === game.myColor}
          />
        </div>

        <div className="space-y-4">
          {game.finished && game.state && (
            <Card className="border-brand-500/25 bg-brand-500/6">
              <div className="flex items-start gap-3">
                <Trophy className="mt-0.5 size-5 shrink-0 text-brand-400" />
                <div>
                  <p className="text-sm font-semibold">{outcomeHeadline(game.state.winner, game.myColor)}</p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {statusLabel(game.state.status, game.state.winner)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void navigate('/gioca')}>
                  Nuova partita
                </Button>
                <Link to={`/riepilogo/${gameId}`}>
                  <Button size="sm" variant="secondary">
                    Rivedi la partita
                  </Button>
                </Link>
                <Link to="/">
                  <Button size="sm" variant="secondary">
                    Home
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {game.opponentGone && !game.finished && (
            <Card className="border-amber-500/25 bg-amber-500/8">
              <p className="text-[13px] text-(--text-secondary)">
                L'avversario si è disconnesso.
                {game.claimWinInSeconds !== null &&
                  ` Potrai rivendicare la vittoria fra ${game.claimWinInSeconds}s.`}
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                loading={busyAction === 'claim'}
                onClick={() => void runAction('claim', () => claimVictory(gameId))}
              >
                Rivendica la vittoria
              </Button>
            </Card>
          )}

          {drawOffered && !game.finished && (
            <Card className="border-brand-500/25 bg-brand-500/6">
              <p className="text-[13px] font-medium">L'avversario propone la patta.</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  loading={busyAction === 'draw-yes'}
                  onClick={() => void runAction('draw-yes', () => handleDraw(gameId, true))}
                >
                  Accetta
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busyAction === 'draw-no'}
                  onClick={() => void runAction('draw-no', () => handleDraw(gameId, false))}
                >
                  Rifiuta
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Mosse"
              subtitle={moveCountLabel(game.ply)}
              action={
                <button
                  type="button"
                  onClick={() => setFlipped((previous) => !previous)}
                  title="Ruota la scacchiera"
                  aria-label="Ruota la scacchiera"
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-(--surface-raised) hover:text-(--text-primary)"
                >
                  <Repeat className="size-4" />
                </button>
              }
            />
            <MoveList sanMoves={game.sanMoves} />
          </Card>

          {!game.finished && (
            <Card>
              <div className="flex flex-wrap gap-2">
                {canAbort ? (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Flag className="size-3.5" />}
                    loading={busyAction === 'abort'}
                    onClick={() => void runAction('abort', () => abortGame(gameId))}
                  >
                    Annulla
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Flag className="size-3.5" />}
                    loading={busyAction === 'resign'}
                    onClick={() => void runAction('resign', () => resignGame(gameId))}
                  >
                    Abbandona
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Handshake className="size-3.5" />}
                  loading={busyAction === 'offer-draw'}
                  onClick={() => void runAction('offer-draw', () => handleDraw(gameId, true))}
                >
                  Offri patta
                </Button>
              </div>
              {/* L'annullamento è possibile solo prima che entrambi abbiano
                  mosso: spiegarlo evita che il pulsante sembri capriccioso. */}
              {canAbort && (
                <p className="mt-2.5 text-[12px] text-muted">
                  Finché nessuno ha mosso due volte la partita può essere annullata senza
                  conseguenze sul rating.
                </p>
              )}
            </Card>
          )}

          {actionError && <ErrorState message={actionError} />}

          {game.connection === 'closed' && !game.finished && (
            <Card>
              <p className="text-[13px] text-muted">
                La connessione allo stream è terminata.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                icon={<RefreshCw className="size-3.5" />}
                onClick={() => window.location.reload()}
              >
                Riconnetti
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/gioca"
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-(--text-primary)"
    >
      <ArrowLeft className="size-4" />
      Gioca
    </Link>
  );
}

function PlayerRow({
  player,
  color,
  clockMs,
  active,
  isSelf = false,
}: {
  player: GameFullPlayer;
  color: Color;
  clockMs: number | null;
  active: boolean;
  isSelf?: boolean;
}) {
  const name =
    player.aiLevel !== undefined
      ? `Stockfish livello ${player.aiLevel}`
      : (player.name ?? 'Anonimo');

  return (
    <div className="flex items-center justify-between gap-3 px-0.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'size-3 shrink-0 rounded-full border',
            color === 'white'
              ? 'border-(--border-strong) bg-white'
              : 'border-ink-700 bg-ink-900',
          )}
        />
        <span className="truncate text-sm font-medium">{name}</span>
        {player.rating !== undefined && (
          <span className="tnum text-[12px] text-muted">
            {player.rating}
            {player.provisional && '?'}
          </span>
        )}
        {isSelf && <Badge tone="brand">tu</Badge>}
      </div>
      {clockMs !== null && <Clock ms={clockMs} active={active} />}
    </div>
  );
}

function outcomeHeadline(winner: Color | undefined, myColor: Color | null): string {
  if (!winner) return 'Partita patta.';
  if (!myColor) return `Hanno vinto ${winner === 'white' ? 'i bianchi' : 'i neri'}.`;
  return winner === myColor ? 'Hai vinto!' : 'Hai perso.';
}
