import { useEffect, useRef, type RefObject } from 'react';
import { cn } from '@/lib/cn';
import { toMovePairs } from '@/lib/chess/rules';

/**
 * Qualità di una mossa. Sono concetti scacchistici, non shape dell'API: la
 * conversione dai `judgment` di Lichess avviene nel chiamante, così la lista
 * mosse resta utilizzabile anche con un'analisi calcolata in locale.
 */
export type MoveMark = 'inaccuracy' | 'mistake' | 'blunder';

const MARKS: Record<MoveMark, { symbol: string; className: string }> = {
  inaccuracy: { symbol: '?!', className: 'text-amber-400' },
  mistake: { symbol: '?', className: 'text-orange-400' },
  blunder: { symbol: '??', className: 'text-(--color-loss)' },
};

/**
 * "12 mosse" a partire da un numero di **semi**mosse, o niente se la partita
 * non ne ha ancora. Sta qui perché la usano sia la partita in corso sia il
 * riepilogo, e sbagliare il singolare è troppo facile.
 */
export function moveCountLabel(plies: number): string | undefined {
  if (plies <= 0) return undefined;
  const moves = Math.ceil(plies / 2);
  return `${moves} ${moves === 1 ? 'mossa' : 'mosse'}`;
}

interface MoveListProps {
  sanMoves: readonly string[];
  className?: string;
  /**
   * Ply mostrato al momento: 0 è la posizione iniziale, N la posizione dopo
   * l'N-esima semimossa. Omesso, viene evidenziata l'ultima mossa giocata —
   * il comportamento che serve alla partita in corso.
   */
  currentPly?: number;
  /** Se presente, le mosse diventano cliccabili e la lista navigabile. */
  onSelect?: (ply: number) => void;
  /** Qualità per mossa, allineata **per indice** a `sanMoves`. */
  marks?: readonly (MoveMark | undefined)[];
}

export function MoveList({ sanMoves, className, currentPly, onSelect, marks }: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLElement | null>(null);

  // La mossa corrente deve restare visibile: senza questo, in partite lunghe
  // la lista resterebbe ferma mentre la scacchiera avanza.
  useEffect(() => {
    const active = activeRef.current;
    const container = scrollRef.current;
    if (!active || !container) return;

    // `scrollIntoView` agirebbe anche sulla pagina, facendola sobbalzare a
    // ogni mossa: lo scroll va calcolato sul solo contenitore.
    const offset =
      active.offsetTop - container.offsetTop - container.clientHeight / 2 + active.clientHeight / 2;
    container.scrollTop = Math.max(0, offset);
  }, [currentPly, sanMoves.length]);

  if (sanMoves.length === 0) {
    return (
      <p className={cn('py-4 text-center text-[13px] text-muted', className)}>
        Nessuna mossa giocata.
      </p>
    );
  }

  const pairs = toMovePairs(sanMoves);
  // Il ply attivo è quello richiesto, oppure l'ultimo: `sanMoves.length` è
  // proprio il ply della posizione finale.
  const activePly = currentPly ?? sanMoves.length;

  return (
    <div ref={scrollRef} className={cn('relative max-h-[280px] overflow-y-auto', className)}>
      <ol className="text-[13px]">
        {pairs.map((pair, pairIndex) => (
          <li
            key={pair.number}
            className="grid grid-cols-[2.2rem_1fr_1fr] items-center gap-1 rounded-md px-1 py-0.5 odd:bg-(--surface-sunken)/50"
          >
            <span className="tnum text-[11.5px] text-muted">{pair.number}.</span>
            <MoveCell
              san={pair.white}
              index={pairIndex * 2}
              activePly={activePly}
              onSelect={onSelect}
              mark={marks?.[pairIndex * 2]}
              activeRef={activeRef}
            />
            <MoveCell
              san={pair.black}
              index={pairIndex * 2 + 1}
              activePly={activePly}
              onSelect={onSelect}
              mark={marks?.[pairIndex * 2 + 1]}
              activeRef={activeRef}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function MoveCell({
  san,
  index,
  activePly,
  onSelect,
  mark,
  activeRef,
}: {
  san: string | undefined;
  index: number;
  activePly: number;
  onSelect?: (ply: number) => void;
  mark?: MoveMark;
  activeRef: RefObject<HTMLElement | null>;
}) {
  if (!san) return <span />;

  // La mossa di indice i porta alla posizione di ply i+1.
  const ply = index + 1;
  const isActive = ply === activePly;
  const decoration = mark ? MARKS[mark] : undefined;

  const content = (
    <>
      {san}
      {decoration && (
        <span className={cn('ml-0.5 font-bold', decoration.className)}>{decoration.symbol}</span>
      )}
    </>
  );

  const classes = cn(
    'rounded px-1 py-0.5 text-left font-medium',
    isActive ? 'bg-brand-500/20 text-brand-300' : 'text-(--text-secondary)',
  );

  // Ref via callback invece del RefObject: quello tipizzato su HTMLElement non
  // è assegnabile a uno span o a un button senza cast.
  const captureActive = (node: HTMLElement | null) => {
    if (isActive) activeRef.current = node;
  };

  if (!onSelect) {
    return (
      <span ref={captureActive} className={classes}>
        {content}
      </span>
    );
  }

  return (
    <button
      ref={captureActive}
      type="button"
      aria-current={isActive ? 'true' : undefined}
      onClick={() => onSelect(ply)}
      className={cn(classes, 'transition-colors', !isActive && 'hover:bg-(--surface-raised)')}
    >
      {content}
    </button>
  );
}
