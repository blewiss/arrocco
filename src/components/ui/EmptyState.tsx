import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-10 text-center',
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
