/**
 * Messaggi di benvenuto in rotazione per l'H1 della home.
 *
 * La scelta è deterministica sulla mezz'ora corrente: il messaggio non cambia a
 * ogni re-render di React (sarebbe fastidioso e farebbe "saltare" il titolo),
 * ma cambia abbastanza spesso da non annoiare.
 *
 * ## Come aggiungerne
 *
 * Basta aggiungere una riga a una delle due liste. La parte fra *asterischi*
 * viene evidenziata (colore di brand e corsivo): serve a dare movimento al
 * titolo, quindi vale la pena sceglierla bene — di solito la parola che porta
 * il senso della frase, non un articolo o un verbo di servizio.
 *
 *   'Oggi si *arrocca*?'
 *
 * Gli asterischi sono facoltativi: una frase senza evidenziazione resta tutta
 * del colore del titolo. Se ne servono più d'uno nella stessa frase funziona,
 * ma di norma una sola parola rende meglio.
 */
const GREETINGS = [
  'Pronto a dare *scacco matto*?',
  'La *scacchiera* ti aspetta.',
  'Che si muova il *primo pedone*.',
  'Oggi si *arrocca*?',
  'Un altro *re* da mettere sotto assedio.',
  'Il tuo prossimo *capolavoro* inizia qui.',
  'Le bianche muovono. *Tocca a te.*',
  'Facciamo tremare qualche *regina*.',
  'Il *centro* non si conquista da solo.',
  'Ogni grande partita inizia con *una mossa*.',
] as const;

/** Messaggi usati quando l'utente ha una streak da difendere. */
const STREAK_GREETINGS = [
  'La *serie* continua?',
  'Non fermarti *adesso*.',
  'La tua *striscia* ti guarda.',
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

export interface TextSegment {
  text: string;
  highlight: boolean;
}

/**
 * Spezza una frase nei suoi tratti normali ed evidenziati.
 *
 * Il parsing sta qui e non nel componente perché è logica, non presentazione:
 * come si *disegna* un tratto evidenziato lo decide la home. Gli asterischi
 * spaiati non sono un errore — vengono lasciati nel testo così come sono,
 * invece di far sparire mezza frase.
 */
export function splitHighlights(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Coppie di asterischi con almeno un carattere in mezzo; `[^*]` impedisce
  // di scavalcare un asterisco e inghiottire il resto della frase.
  const pattern = /\*([^*]+)\*/g;

  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), highlight: false });
    segments.push({ text: match[1] as string, highlight: true });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlight: false });

  return segments;
}
