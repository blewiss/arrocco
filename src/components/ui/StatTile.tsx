import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Unità o suffisso reso più piccolo accanto al valore, es. "%" o "giorni". */
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'brand' | 'win' | 'loss';
  className?: string;
}

const TONES: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'text-(--text-primary)',
  brand: 'text-brand-400',
  win: 'text-(--color-win)',
  loss: 'text-(--color-loss)',
};

export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  tone = 'default',
  className,
}: StatTileProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn('tnum text-2xl leading-none font-semibold', TONES[tone])}>{value}</span>
        {unit && <span className="text-[13px] text-muted">{unit}</span>}
      </div>
      {hint && <div className="text-[12px] leading-snug text-muted">{hint}</div>}
    </div>
  );
}
