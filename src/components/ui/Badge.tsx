import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'brand' | 'win' | 'loss' | 'draw';

const TONES: Record<Tone, string> = {
  neutral: 'bg-(--surface-sunken) text-(--text-secondary) border-(--border-subtle)',
  brand: 'bg-brand-500/12 text-brand-400 border-brand-500/25',
  win: 'bg-(--color-win)/12 text-(--color-win) border-(--color-win)/25',
  loss: 'bg-(--color-loss)/12 text-(--color-loss) border-(--color-loss)/25',
  draw: 'bg-(--color-draw)/12 text-(--color-draw) border-(--color-draw)/25',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5',
        'text-[11px] font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Pastiglia quadrata W/L/P per l'esito di una partita.
 * Il carattere è sempre uno solo, così le liste restano allineate.
 */
export function OutcomeChip({ outcome }: { outcome: 'win' | 'loss' | 'draw' | 'unfinished' }) {
  const config = {
    win: { label: 'V', title: 'Vittoria', className: 'bg-(--color-win)/15 text-(--color-win)' },
    loss: {
      label: 'S',
      title: 'Sconfitta',
      className: 'bg-(--color-loss)/15 text-(--color-loss)',
    },
    draw: { label: 'P', title: 'Patta', className: 'bg-(--color-draw)/15 text-(--color-draw)' },
    unfinished: {
      label: '–',
      title: 'Senza risultato',
      className: 'bg-(--surface-sunken) text-muted',
    },
  }[outcome];

  return (
    <span
      title={config.title}
      aria-label={config.title}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-md',
        'text-[12px] font-bold',
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}
