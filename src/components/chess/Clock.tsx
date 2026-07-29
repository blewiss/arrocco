import { cn } from '@/lib/cn';

/**
 * Formato dell'orologio: `m:ss` sopra i 20 secondi, `s.d` sotto.
 * Il passaggio ai decimi in zeitnot è la convenzione di Lichess e comunica
 * urgenza senza bisogno di altri segnali.
 */
export function formatClock(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 20_000) {
    const seconds = Math.floor(safe / 1000);
    const tenths = Math.floor((safe % 1000) / 100);
    return `${seconds}.${tenths}`;
  }

  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface ClockProps {
  ms: number;
  active: boolean;
  className?: string;
}

export function Clock({ ms, active, className }: ClockProps) {
  const critical = ms < 20_000;

  return (
    <div
      // `role=timer` con aria-live off: un lettore di schermo non deve
      // annunciare ogni decimo di secondo.
      role="timer"
      aria-live="off"
      className={cn(
        'tnum rounded-[10px] px-3 py-1.5 text-xl leading-none font-semibold tracking-tight',
        'transition-colors duration-200 tabular-nums',
        active
          ? critical
            ? 'bg-(--color-loss)/15 text-(--color-loss)'
            : 'bg-brand-500/15 text-brand-300'
          : 'bg-(--surface-sunken) text-(--text-secondary)',
        className,
      )}
    >
      {formatClock(ms)}
    </div>
  );
}
