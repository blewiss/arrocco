import { cn } from '@/lib/cn';
import type { Color } from '@/lib/lichess/types';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const PIECES: Array<{ code: PromotionPiece; name: string; glyph: Record<Color, string> }> = [
  { code: 'q', name: 'Donna', glyph: { white: '♕', black: '♛' } },
  { code: 'r', name: 'Torre', glyph: { white: '♖', black: '♜' } },
  { code: 'b', name: 'Alfiere', glyph: { white: '♗', black: '♝' } },
  { code: 'n', name: 'Cavallo', glyph: { white: '♘', black: '♞' } },
];

interface PromotionPickerProps {
  color: Color;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

/**
 * Scelta del pezzo di promozione.
 *
 * È un overlay sulla scacchiera invece di un dialog centrato: la mossa è già
 * "in volo" e spostare lo sguardo altrove romperebbe il flusso del gioco.
 */
export function PromotionPicker({ color, onSelect, onCancel }: PromotionPickerProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scegli il pezzo di promozione"
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      // Un click fuori dai pulsanti annulla: la mossa non è ancora inviata.
      onClick={onCancel}
    >
      <div
        className="flex gap-2 rounded-2xl border border-(--border-strong) bg-(--surface-raised) p-2.5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {PIECES.map((piece) => (
          <button
            key={piece.code}
            type="button"
            title={piece.name}
            aria-label={piece.name}
            autoFocus={piece.code === 'q'}
            onClick={() => onSelect(piece.code)}
            className={cn(
              'flex size-14 items-center justify-center rounded-xl text-4xl leading-none',
              'transition-colors hover:bg-brand-500/20',
              color === 'white' ? 'text-white' : 'text-ink-950 dark:text-ink-100',
            )}
          >
            <span className={color === 'white' ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]' : ''}>
              {piece.glyph[color]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
