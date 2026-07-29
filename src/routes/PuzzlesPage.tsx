import { Check, Eye, Lightbulb, RotateCcw, Target, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Key } from 'chessground/types';
import { Board } from '@/components/chess/Board';
import { PromotionPicker } from '@/components/chess/PromotionPicker';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/lib/auth/store';
import { isPromotion } from '@/lib/chess/rules';
import { cn } from '@/lib/cn';
import { usePuzzleTrainer } from '@/lib/hooks/usePuzzleTrainer';
import type { PuzzleDifficulty } from '@/lib/lichess/api';
import { LICHESS_ORIGIN } from '@/lib/lichess/config';
import { THEME_LABELS } from '@/lib/puzzleThemes';

const DIFFICULTIES: Array<{ value: PuzzleDifficulty; label: string }> = [
  { value: 'easiest', label: 'Facilissimo' },
  { value: 'easier', label: 'Facile' },
  { value: 'normal', label: 'Normale' },
  { value: 'harder', label: 'Difficile' },
  { value: 'hardest', label: 'Estremo' },
];

export function PuzzlesPage() {
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>('normal');
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Key; to: Key } | null>(null);
  const authenticated = useAuth((state) => state.status === 'authenticated');

  const trainer = usePuzzleTrainer(difficulty);

  return (
    <div className="animate-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] leading-tight font-semibold tracking-tight md:text-[28px]">
            Puzzle
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Trova la mossa migliore. La difficoltà è relativa al tuo rating.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Difficoltà"
          className="flex gap-0.5 rounded-[10px] bg-(--surface-sunken) p-0.5"
        >
          {DIFFICULTIES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={difficulty === option.value}
              onClick={() => setDifficulty(option.value)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                difficulty === option.value
                  ? 'bg-(--surface-raised) text-brand-400 shadow-sm'
                  : 'text-muted hover:text-(--text-primary)',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {trainer.error ? (
        <ErrorState message={trainer.error} onRetry={trainer.next} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative">
            {trainer.loading && !trainer.puzzle ? (
              <Skeleton className="aspect-square w-full rounded-xl" />
            ) : (
              <>
                <Board
                  fen={trainer.fen}
                  orientation={trainer.orientation}
                  turnColor={trainer.turn}
                  lastMove={trainer.lastMove}
                  check={trainer.check}
                  movableColor={trainer.movableColor}
                  dests={trainer.dests}
                  revision={trainer.revision}
                  onMove={(from, to) => {
                    // La promozione va risolta prima di valutare la mossa,
                    // altrimenti l'UCI sarebbe incompleto e il confronto con
                    // la soluzione fallirebbe.
                    if (isPromotion(trainer.chess, from, to)) {
                      setPendingPromotion({ from, to });
                      return;
                    }
                    trainer.playMove(from, to);
                  }}
                  feedback={
                    trainer.phase === 'solved'
                      ? 'win'
                      : trainer.phase === 'failed'
                        ? 'fail'
                        : undefined
                  }
                />
                {pendingPromotion && (
                  <PromotionPicker
                    color={trainer.orientation}
                    onCancel={() => setPendingPromotion(null)}
                    onSelect={(piece) => {
                      const { from, to } = pendingPromotion;
                      setPendingPromotion(null);
                      trainer.playMove(from, to, piece);
                    }}
                  />
                )}
              </>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              {trainer.loading && !trainer.puzzle ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : (
                <>
                  <StatusPanel trainer={trainer} />

                  <div className="mt-4 flex flex-wrap gap-2">
                    {trainer.phase === 'solved' ? (
                      <Button fullWidth onClick={trainer.next} loading={trainer.loading}>
                        Puzzle successivo
                      </Button>
                    ) : trainer.phase === 'failed' ? (
                      <>
                        <Button
                          size="sm"
                          icon={<RotateCcw className="size-3.5" />}
                          onClick={trainer.retry}
                        >
                          Riprova
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Eye className="size-3.5" />}
                          onClick={trainer.revealSolution}
                        >
                          Mostra soluzione
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Eye className="size-3.5" />}
                        onClick={trainer.revealSolution}
                      >
                        Mostra soluzione
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Card>

            {trainer.puzzle && (
              <Card>
                <CardHeader title="Dettagli" />
                <dl className="space-y-2.5 text-[13px]">
                  <Row label="Rating">
                    <span className="tnum font-medium">{trainer.puzzle.puzzle.rating}</span>
                  </Row>
                  <Row label="Tentativi">
                    <span className="tnum">
                      {trainer.puzzle.puzzle.plays.toLocaleString('it-IT')}
                    </span>
                  </Row>
                  <Row label="Mosse da trovare">
                    <span className="tnum">{trainer.progress.total}</span>
                  </Row>
                </dl>

                {/* I temi rivelano la soluzione (es. "matto in 2"), quindi
                    restano nascosti finché il puzzle non è concluso. */}
                {trainer.phase === 'solved' ? (
                  <div className="mt-4 border-t border-(--border-subtle) pt-3.5">
                    <p className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">
                      Temi
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {trainer.puzzle.puzzle.themes.map((theme) => (
                        <Badge key={theme}>{THEME_LABELS[theme] ?? theme}</Badge>
                      ))}
                    </div>
                    <a
                      href={`${LICHESS_ORIGIN}/training/${trainer.puzzle.puzzle.id}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 inline-block text-[12.5px] font-medium text-brand-400 hover:text-brand-300"
                    >
                      Analizza su Lichess →
                    </a>
                  </div>
                ) : (
                  <p className="mt-4 border-t border-(--border-subtle) pt-3.5 text-[12px] text-muted">
                    I temi vengono svelati alla fine: anticiparli renderebbe il puzzle troppo
                    facile.
                  </p>
                )}
              </Card>
            )}

            {!authenticated && (
              <Card className="border-brand-500/25 bg-brand-500/6">
                <p className="text-[12.5px] leading-relaxed text-(--text-secondary)">
                  Stai allenandoti senza aver effettuato l'accesso: i puzzle risolti non vengono
                  registrati sul tuo account e il rating non cambia.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPanel({ trainer }: { trainer: ReturnType<typeof usePuzzleTrainer> }) {
  if (trainer.phase === 'solved') {
    return (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--color-win)/15">
          <Check className="size-4 text-(--color-win)" />
        </div>
        <div>
          <p className="text-sm font-semibold text-(--color-win)">
            {trainer.flawless ? 'Risolto!' : 'Soluzione completata'}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">
            {trainer.flawless
              ? 'Corretto al primo tentativo.'
              : 'Il puzzle conta come sbagliato, ma la sequenza è questa.'}
            {trainer.ratingDiff !== null && (
              <span
                className={cn(
                  'tnum ml-1.5 font-medium',
                  trainer.ratingDiff >= 0 ? 'text-(--color-win)' : 'text-(--color-loss)',
                )}
              >
                {trainer.ratingDiff > 0 ? '+' : ''}
                {trainer.ratingDiff}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (trainer.phase === 'failed') {
    return (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--color-loss)/15">
          <X className="size-4 text-(--color-loss)" />
        </div>
        <div>
          <p className="text-sm font-semibold text-(--color-loss)">Non è quella</p>
          <p className="mt-0.5 text-[13px] text-muted">
            C'è una mossa migliore. Riprova, oppure svela la soluzione.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/15">
        <Target className="size-4 text-brand-400" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {trainer.orientation === 'white' ? 'Muovono i bianchi' : 'Muovono i neri'}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
          <Lightbulb className="size-3.5" />
          Trova la mossa migliore
          {trainer.progress.total > 1 && (
            <span className="tnum">
              ({trainer.progress.done}/{trainer.progress.total})
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
