import type { MoveMark } from '@/components/chess/MoveList';
import type { JudgmentName, MoveAnalysis } from '../lichess/types';

/**
 * Presentazione delle valutazioni del motore.
 *
 * Qui non si *giudica* nulla: le etichette di imprecisione, errore e svista
 * arrivano già pronte da Lichess, che le calcola server-side. Questo modulo si
 * limita a formattarle e a trasformare i centipawn in una percentuale usabile
 * per la barra di valutazione.
 */

/** Traduzione in italiano dei giudizi, che l'API restituisce in inglese. */
const JUDGMENT_LABELS: Record<JudgmentName, string> = {
  Inaccuracy: 'Imprecisione',
  Mistake: 'Errore',
  Blunder: 'Svista',
};

export function judgmentLabel(name: JudgmentName): string {
  return JUDGMENT_LABELS[name];
}

const JUDGMENT_MARKS: Record<JudgmentName, MoveMark> = {
  Inaccuracy: 'inaccuracy',
  Mistake: 'mistake',
  Blunder: 'blunder',
};

export function judgmentMark(name: JudgmentName): MoveMark {
  return JUDGMENT_MARKS[name];
}

/**
 * Valutazione leggibile dal punto di vista del bianco: `+1.44`, `-0.55`,
 * `#3` per il matto del bianco, `#-2` per quello del nero.
 */
export function formatEval(entry: MoveAnalysis | undefined): string | null {
  if (!entry) return null;
  if (entry.mate !== undefined) return `#${entry.mate}`;
  if (entry.eval === undefined) return null;
  const pawns = entry.eval / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

/**
 * Quota di vantaggio del bianco, 0–100, per la barra di valutazione.
 *
 * La sigmoide sui centipawn è quella usata da Lichess per convertire una
 * valutazione in probabilità di vittoria. Serve **solo** a dare alla barra una
 * progressione percettivamente sensata — un +9 non deve riempirla come un +3 —
 * e non entra in nessun giudizio sulle mosse: quelli restano quelli di
 * Lichess. La costante viene dal sorgente di lila; se un giorno la si volesse
 * usare per calcolare accuracy in locale, va riverificata lì.
 */
export function whiteAdvantagePercent(entry: MoveAnalysis | undefined): number {
  if (!entry) return 50;

  if (entry.mate !== undefined) {
    // Un matto è una barra piena, col segno di chi lo dà. `mate: 0` non
    // dovrebbe arrivare, ma trattarlo come vittoria del bianco è innocuo.
    return entry.mate >= 0 ? 100 : 0;
  }
  if (entry.eval === undefined) return 50;

  const clamped = Math.max(-1000, Math.min(1000, entry.eval));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}
