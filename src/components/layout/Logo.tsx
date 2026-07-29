import { cn } from '@/lib/cn';

/**
 * Marchio di Arrocco: una torre stilizzata, il pezzo che dà il nome all'app.
 * L'arrocco è la mossa che coinvolge re e torre, da cui il simbolo.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-[9px]',
        'bg-linear-to-br from-brand-400 to-brand-600 text-white shadow-sm',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
        {/* Merlatura, corpo e base della torre */}
        <path d="M5.4 3h2.4v2.1h2.05V3h3.7v2.1h2.05V3h2.4v5.05l-1.7 1.7v5.2l1.9 4.15V21H4.2v-1.9l1.9-4.15v-5.2L4.4 8.05V3h1zm3.3 8.1v3.55h6.6V11.1H8.7z" />
      </svg>
    </div>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[15px] font-semibold tracking-tight', className)}>Arrocco</span>
  );
}
