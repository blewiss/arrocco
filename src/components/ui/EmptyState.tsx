import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /**
   * Riduce i margini interni, per gli spazi vuoti dentro card strette.
   * È una prop e non una classe perché sovrascrivere `px-6 py-10` dall'esterno
   * non funzionerebbe: fra due utility di padding Tailwind vince quella che
   * compare più tardi nel CSS generato, non quella passata per ultima.
   */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'px-0 py-6' : 'px-6 py-10',
        className,
      )}
    >
      {icon && (
        <div className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-(--text-primary)">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Riquadro d'errore con possibilità di ritentare. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-(--color-loss)/25 bg-(--color-loss)/8 px-4 py-3',
        className,
      )}
    >
      <p className="text-[13px] leading-relaxed text-(--color-loss)">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-[13px] font-medium text-(--text-primary) underline decoration-(--border-strong) underline-offset-2 hover:decoration-current"
        >
          Riprova
        </button>
      )}
    </div>
  );
}
