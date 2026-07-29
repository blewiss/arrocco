/**
 * Aggregazione dell'attività per giorno: alimenta le heatmap a quadratini e il
 * conteggio delle streak.
 *
 * Tutto il raggruppamento avviene in ora **locale**: se un utente gioca alle
 * 23:30, quella partita deve contare per il giorno che sta vivendo, non per il
 * giorno UTC. Per questo non si usa mai `toISOString()` per derivare la data.
 */

/** Chiave di giorno locale, `YYYY-MM-DD`. */
export type DayKey = string;

export function dayKey(date: Date): DayKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dayKeyFromTimestamp(timestamp: number): DayKey {
  return dayKey(new Date(timestamp));
}

/** Mezzanotte locale di `date`, utile come base per l'aritmetica sui giorni. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Conta gli eventi per giorno locale. */
export function countByDay(timestamps: readonly number[]): Map<DayKey, number> {
  const counts = new Map<DayKey, number>();
  for (const timestamp of timestamps) {
    const key = dayKeyFromTimestamp(timestamp);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export interface StreakInfo {
  /** Giorni consecutivi fino a oggi. Un'attività solo ieri vale comunque 1. */
  current: number;
  longest: number;
  /** Numero di giorni distinti con attività nel periodo considerato. */
  activeDays: number;
  /** True se c'è stata attività oggi: distingue "streak vivo" da "a rischio". */
  activeToday: boolean;
}

/**
 * Calcola la streak corrente e la più lunga.
 *
 * La streak corrente non si azzera se oggi non si è ancora giocato: finché
 * ieri era attivo, la serie è considerata viva (è la convenzione usata da
 * Duolingo, GitHub e simili, ed è quella che l'utente si aspetta). Il flag
 * `activeToday` permette alla UI di dire "gioca oggi per non perderla".
 */
export function computeStreak(countsByDay: Map<DayKey, number>, today = new Date()): StreakInfo {
  const activeDays = countsByDay.size;
  if (activeDays === 0) {
    return { current: 0, longest: 0, activeDays: 0, activeToday: false };
  }

  const todayStart = startOfDay(today);
  const activeToday = countsByDay.has(dayKey(todayStart));

  // Streak corrente: si parte da oggi se attivo, altrimenti da ieri.
  let current = 0;
  let cursor = activeToday ? todayStart : addDays(todayStart, -1);
  while (countsByDay.has(dayKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Streak più lunga: scorriamo i giorni attivi ordinati e misuriamo le
  // sequenze contigue. Confrontare le date come timestamp di mezzanotte evita
  // problemi con i cambi di ora legale (la differenza non è sempre 24h).
  const sortedDays = [...countsByDay.keys()].sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;

  for (const key of sortedDays) {
    const day = startOfDay(parseDayKey(key));
    if (previous && dayKey(addDays(previous, 1)) === key) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest: Math.max(longest, current), activeDays, activeToday };
}

export function parseDayKey(key: DayKey): Date {
  const [year, month, day] = key.split('-').map(Number);
  // Costruttore a componenti: interpreta i valori in ora locale, coerente con
  // come le chiavi sono state generate.
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export interface HeatCell {
  key: DayKey;
  date: Date;
  count: number;
  /** 0 = nessuna attività, 1–4 intensità crescente. */
  level: 0 | 1 | 2 | 3 | 4;
  /** True per i giorni futuri della settimana in corso: resi come vuoti. */
  future: boolean;
}

export interface ActivityCalendar {
  /** Colonne = settimane, dalla più vecchia alla più recente. Ogni colonna ha
   *  7 celle, da domenica a sabato o da lunedì, secondo `weekStartsOn`. */
  weeks: HeatCell[][];
  totalCount: number;
  streak: StreakInfo;
}

export interface CalendarOptions {
  weeks?: number;
  /** 0 = domenica, 1 = lunedì. In Italia la settimana inizia di lunedì. */
  weekStartsOn?: 0 | 1;
  today?: Date;
}

/**
 * Costruisce la griglia della heatmap allineata alle settimane.
 *
 * Le soglie di intensità sono derivate dai dati (quartili sui giorni attivi)
 * invece di essere fisse: così la heatmap resta leggibile sia per chi fa 2
 * partite al giorno sia per chi ne fa 50.
 */
export function buildActivityCalendar(
  countsByDay: Map<DayKey, number>,
  { weeks = 18, weekStartsOn = 1, today = new Date() }: CalendarOptions = {},
): ActivityCalendar {
  const todayStart = startOfDay(today);

  // Fine griglia: l'ultimo giorno della settimana che contiene oggi, così la
  // colonna corrente è completa e i giorni futuri restano visibili ma spenti.
  const offsetInWeek = (todayStart.getDay() - weekStartsOn + 7) % 7;
  const lastDay = addDays(todayStart, 6 - offsetInWeek);
  const firstDay = addDays(lastDay, -(weeks * 7 - 1));

  const thresholds = intensityThresholds(countsByDay);

  const grid: HeatCell[][] = [];
  let totalCount = 0;

  for (let week = 0; week < weeks; week += 1) {
    const column: HeatCell[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      const date = addDays(firstDay, week * 7 + dayOfWeek);
      const key = dayKey(date);
      const future = date.getTime() > todayStart.getTime();
      const count = future ? 0 : (countsByDay.get(key) ?? 0);
      totalCount += count;
      column.push({ key, date, count, level: intensityLevel(count, thresholds), future });
    }
    grid.push(column);
  }

  return { weeks: grid, totalCount, streak: computeStreak(countsByDay, today) };
}

function intensityThresholds(countsByDay: Map<DayKey, number>): [number, number, number] {
  const values = [...countsByDay.values()].filter((value) => value > 0).sort((a, b) => a - b);
  if (values.length === 0) return [1, 2, 3];

  const quantile = (fraction: number): number => {
    const index = Math.min(values.length - 1, Math.floor(values.length * fraction));
    return values[index] ?? 1;
  };

  // Soglie strettamente crescenti, altrimenti livelli diversi collasserebbero
  // sullo stesso colore su dataset piccoli.
  const first = Math.max(1, quantile(0.25));
  const second = Math.max(first + 1, quantile(0.5));
  const third = Math.max(second + 1, quantile(0.8));
  return [first, second, third];
}

function intensityLevel(count: number, [first, second, third]: [number, number, number]) {
  if (count <= 0) return 0 as const;
  if (count < second) return (count <= first ? 1 : 2) as 1 | 2;
  if (count < third) return 3 as const;
  return 4 as const;
}
