import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { ActivityCalendar, HeatCell } from '@/lib/stats/activity';

/** Un colore per livello. Il livello 0 usa il token che segue il tema. */
const LEVEL_STYLES: Record<HeatCell['level'], string> = {
  0: 'bg-(--heat-empty)',
  1: 'bg-brand-500/30',
  2: 'bg-brand-500/55',
  3: 'bg-brand-500/80',
  4: 'bg-brand-400',
};

const WEEKDAY_INITIALS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

const MONTH_SHORT = [
  'gen',
  'feb',
  'mar',
  'apr',
  'mag',
  'giu',
  'lug',
  'ago',
  'set',
  'ott',
  'nov',
  'dic',
];

interface HeatmapProps {
  calendar: ActivityCalendar;
  /** Nome dell'unità misurata, per le etichette: "partita"/"partite". */
  unit: { one: string; many: string };
  className?: string;
}

export function Heatmap({ calendar, unit, className }: HeatmapProps) {
  // Etichette dei mesi: una sola per mese, posizionata sulla prima settimana
  // in cui quel mese compare, così non si sovrappongono.
  const monthLabels = useMemo(() => {
    const labels: Array<{ weekIndex: number; label: string }> = [];
    let lastMonth = -1;
    calendar.weeks.forEach((week, weekIndex) => {
      const firstOfWeek = week[0];
      if (!firstOfWeek) return;
      const month = firstOfWeek.date.getMonth();
      if (month !== lastMonth) {
        labels.push({ weekIndex, label: MONTH_SHORT[month] ?? '' });
        lastMonth = month;
      }
    });
    return labels;
  }, [calendar.weeks]);

  return (
    <div className={cn('flex gap-1.5', className)}>
      {/* Iniziali dei giorni: mostrate a righe alterne per non affollare */}
      <div
        className="grid shrink-0 gap-[3px] pt-[18px] text-[9px] leading-none text-muted"
        aria-hidden="true"
      >
        {WEEKDAY_INITIALS.map((initial, index) => (
          <div key={index} className="flex h-[13px] items-center">
            {index % 2 === 0 ? initial : ''}
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="inline-block">
          {/* Riga dei mesi, allineata alle colonne tramite lo stesso grid */}
          <div
            className="relative mb-1 h-[14px] text-[10px] leading-none text-muted"
            aria-hidden="true"
          >
            {monthLabels.map(({ weekIndex, label }) => (
              <span
                key={`${label}-${weekIndex}`}
                className="absolute top-0"
                style={{ left: `${weekIndex * 16}px` }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {calendar.weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid gap-[3px]">
                {week.map((cell) => (
                  <Cell key={cell.key} cell={cell} unit={unit} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({ cell, unit }: { cell: HeatCell; unit: { one: string; many: string } }) {
  // I giorni futuri non sono dati: restano invisibili ma occupano lo spazio,
  // così la griglia mantiene la forma rettangolare.
  if (cell.future) {
    return <div className="size-[13px] rounded-[3px]" aria-hidden="true" />;
  }

  const label = `${cell.date.getDate()} ${MONTH_SHORT[cell.date.getMonth()]}: ${
    cell.count === 0
      ? `nessuna ${unit.one}`
      : `${cell.count} ${cell.count === 1 ? unit.one : unit.many}`
  }`;

  return (
    <div
      // `title` dà il tooltip nativo, che funziona anche da tastiera in molti
      // browser; `aria-label` con role=img lo rende leggibile agli screen reader.
      title={label}
      role="img"
      aria-label={label}
      className={cn(
        'size-[13px] rounded-[3px] transition-transform duration-100 hover:scale-125',
        LEVEL_STYLES[cell.level],
      )}
    />
  );
}

/** Legenda compatta "meno → più". */
export function HeatmapLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 text-[11px] text-muted', className)}>
      <span>meno</span>
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <div key={level} className={cn('size-[10px] rounded-[3px]', LEVEL_STYLES[level])} />
      ))}
      <span>più</span>
    </div>
  );
}
