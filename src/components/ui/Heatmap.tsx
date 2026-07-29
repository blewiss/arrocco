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

/* ── Geometria ─────────────────────────────────────────────────────────────
   Esportata perché il layout deve poter dimensionare il contenitore sulla
   heatmap invece di indovinarne la larghezza: una card molto più larga del suo
   contenuto lascia spazio vuoto, e `max-content` non funziona qui perché
   misurerebbe il sottotitolo dell'intestazione a riga intera. */

const CELL_PX = 13;
const CELL_GAP_PX = 3;
/** Passo fra due colonne: usato anche per posizionare le etichette dei mesi. */
const WEEK_STEP_PX = CELL_PX + CELL_GAP_PX;
/** Colonna delle iniziali dei giorni, a larghezza fissa per essere prevedibile. */
const WEEKDAY_COL_PX = 12;
const WEEKDAY_GAP_PX = 6;
/** Striscia con le etichette dei mesi sopra la griglia. */
const MONTH_ROW_PX = 18;

/** Larghezza esatta in px della heatmap, senza padding del contenitore. */
export function heatmapContentWidth(weeks: number): number {
  return WEEKDAY_COL_PX + WEEKDAY_GAP_PX + (weeks * WEEK_STEP_PX - CELL_GAP_PX);
}

/**
 * Altezza esatta in px: striscia dei mesi più sette righe di celle.
 * Serve agli skeleton di caricamento, che altrimenti provocano un salto di
 * layout quando i dati arrivano.
 */
export const HEATMAP_HEIGHT_PX = MONTH_ROW_PX + 7 * CELL_PX + 6 * CELL_GAP_PX;

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
    <div
      className={cn('flex', className)}
      style={{ gap: `${WEEKDAY_GAP_PX}px` }}
    >
      {/* Iniziali dei giorni: mostrate a righe alterne per non affollare */}
      <div
        className="grid shrink-0 text-[9px] leading-none text-muted"
        style={{
          width: `${WEEKDAY_COL_PX}px`,
          gap: `${CELL_GAP_PX}px`,
          // Allinea la prima cella alla prima riga di quadratini, saltando la
          // striscia delle etichette dei mesi.
          paddingTop: `${MONTH_ROW_PX}px`,
        }}
        aria-hidden="true"
      >
        {WEEKDAY_INITIALS.map((initial, index) => (
          <div key={index} className="flex items-center" style={{ height: `${CELL_PX}px` }}>
            {index % 2 === 0 ? initial : ''}
          </div>
        ))}
      </div>

      <div>
        {/* Etichette dei mesi, posizionate sul passo delle colonne */}
        <div
          className="relative text-[10px] leading-none text-muted"
          style={{ height: `${MONTH_ROW_PX}px` }}
          aria-hidden="true"
        >
          {monthLabels.map(({ weekIndex, label }) => (
            <span
              key={`${label}-${weekIndex}`}
              className="absolute top-0"
              style={{ left: `${weekIndex * WEEK_STEP_PX}px` }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex" style={{ gap: `${CELL_GAP_PX}px` }}>
          {calendar.weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid" style={{ gap: `${CELL_GAP_PX}px` }}>
              {week.map((cell) => (
                <Cell key={cell.key} cell={cell} unit={unit} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cell({ cell, unit }: { cell: HeatCell; unit: { one: string; many: string } }) {
  const size = { width: `${CELL_PX}px`, height: `${CELL_PX}px` };

  // I giorni futuri non sono dati: restano invisibili ma occupano lo spazio,
  // così la griglia mantiene la forma rettangolare.
  if (cell.future) {
    return <div className="rounded-[3px]" style={size} aria-hidden="true" />;
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
      style={size}
      className={cn(
        'rounded-[3px] transition-transform duration-100 hover:scale-125',
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
