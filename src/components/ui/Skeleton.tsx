import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';

/**
 * Placeholder di caricamento. Usa `animate-pulse` di Tailwind, che rispetta
 * `prefers-reduced-motion` grazie alla regola globale in index.css.
 */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-(--surface-sunken)', className)}
      style={style}
    />
  );
}

/** Larghezze irregolari: il blocco legge come testo, non come barre uguali. */
const LINE_WIDTHS = ['92%', '78%', '85%', '64%', '88%', '71%'];

/** Righe di testo simulate, per liste e tabelle in caricamento. */
export function SkeletonLines({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          className="h-4"
          style={{ width: LINE_WIDTHS[index % LINE_WIDTHS.length] }}
        />
      ))}
    </div>
  );
}
