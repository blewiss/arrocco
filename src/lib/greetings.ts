/**
 * Messaggi di benvenuto in rotazione per l'H1 della home.
 *
 * La scelta è deterministica sulla mezz'ora corrente: il messaggio non cambia a
 * ogni re-render di React (sarebbe fastidioso e farebbe "saltare" il titolo),
 * ma cambia abbastanza spesso da non annoiare.
 */
const GREETINGS = [
  'Pronto a dare scacco matto?',
  'La scacchiera ti aspetta.',
  'Che si muova il primo pedone.',
  'Oggi si arrocca?',
  'Un altro re da mettere sotto assedio.',
  'Il tuo prossimo capolavoro inizia qui.',
  'Le bianche muovono. Tocca a te.',
  'Facciamo tremare qualche regina.',
  'Il centro non si conquista da solo.',
  'Ogni grande partita inizia con una mossa.',
] as const;

/** Messaggi usati quando l'utente ha una streak da difendere. */
const STREAK_GREETINGS = [
  'La serie continua?',
  'Non fermarti adesso.',
  'La tua striscia ti guarda.',
] as const;

const HALF_HOUR_MS = 30 * 60 * 1000;

export function pickGreeting(options: { streakAtRisk?: boolean; seed?: number } = {}): string {
  const seed = options.seed ?? Math.floor(Date.now() / HALF_HOUR_MS);

  // Con una streak viva ma nessuna attività oggi, un messaggio dedicato è più
  // utile di uno generico: spinge all'azione che l'utente vuole compiere.
  if (options.streakAtRisk) {
    return STREAK_GREETINGS[seed % STREAK_GREETINGS.length] as string;
  }

  return GREETINGS[seed % GREETINGS.length] as string;
}
