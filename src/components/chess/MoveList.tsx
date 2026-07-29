import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { toMovePairs } from '@/lib/chess/rules';

interface MoveListProps {
  sanMoves: readonly string[];
  className?: string;
}

export function MoveList({ sanMoves, className }: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // L'ultima mossa deve restare visibile: senza questo, in partite lunghe la
  // lista resterebbe ferma in cima.
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [sanMoves.length]);

  if (sanMoves.length === 0) {
    return (
      <p className={cn('py-4 text-center text-[13px] text-muted', className)}>
        Nessuna mossa giocata.
      </p>
    );
  }

  const pairs = toMovePairs(sanMoves);
  const lastIndex = sanMoves.length - 1;

  return (
    <div ref={scrollRef} className={cn('max-h-[280px] overflow-y-auto', className)}>
      <ol className="text-[13px]">
        {pairs.map((pair, pairIndex) => (
          <li
            key={pair.number}
            className="grid grid-cols-[2.2rem_1fr_1fr] items-center gap-1 rounded-md px-1 py-0.5 odd:bg-(--surface-sunken)/50"
          >
            <span className="tnum text-[11.5px] text-muted">{pair.number}.</span>
            <MoveCell san={pair.white} isLast={pairIndex * 2 === lastIndex} />
            <MoveCell san={pair.black} isLast={pairIndex * 2 + 1 === lastIndex} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function MoveCell({ san, isLast }: { san: string | undefined; isLast: boolean }) {
  if (!san) return <span />;
  return (
    <span
      className={cn(
        'rounded px-1 py-0.5 font-medium',
        isLast ? 'bg-brand-500/20 text-brand-300' : 'text-(--text-secondary)',
      )}
    >
      {san}
    </span>
  );
}
