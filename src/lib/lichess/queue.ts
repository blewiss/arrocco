/**
 * Limitatore di richieste verso Lichess.
 *
 * Due vincoli reali, verificati sull'API in produzione:
 *
 *  1. Alcuni endpoint (in particolare `/api/games/user/{username}`) rifiutano
 *     con 429 `{"error":"Please only run 1 request(s) at a time"}` qualsiasi
 *     sovrapposizione. Per questo esiste una "corsia seriale" a concorrenza 1.
 *
 *  2. Le linee guida di Lichess chiedono, ricevuto un 429, di attendere un
 *     minuto pieno prima di riprendere. Implementiamo quindi un cooldown
 *     *globale*: un 429 su una qualsiasi richiesta mette in pausa tutte le
 *     successive, invece di insistere e peggiorare la penalità.
 *
 * Nota importante sul rilascio dello slot: `fetch()` risolve appena arrivano
 * gli header, non a corpo completo. Occupiamo quindi la corsia solo fino agli
 * header, così uno stream ndjson long-lived (partita in corso, stream eventi)
 * non blocca il resto dell'app per tutta la sua durata.
 */

export type Lane = 'default' | 'serial';

interface Waiter {
  resolve: () => void;
}

class Semaphore {
  private active = 0;
  private readonly waiting: Waiter[] = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push({ resolve }));
    this.active += 1;
  }

  release(): void {
    this.active -= 1;
    const next = this.waiting.shift();
    if (next) next.resolve();
  }
}

const lanes: Record<Lane, Semaphore> = {
  // Concorrenza 2 sulle chiamate normali: abbastanza per una UI reattiva,
  // abbastanza poco per non essere aggressivi verso un servizio gratuito.
  default: new Semaphore(2),
  serial: new Semaphore(1),
};

/** Timestamp (ms) fino al quale ogni richiesta deve attendere. */
let cooldownUntil = 0;
const cooldownListeners = new Set<(msRemaining: number) => void>();

export function onCooldownChange(listener: (msRemaining: number) => void): () => void {
  cooldownListeners.add(listener);
  return () => cooldownListeners.delete(listener);
}

function notifyCooldown(): void {
  const remaining = Math.max(0, cooldownUntil - Date.now());
  for (const listener of cooldownListeners) listener(remaining);
}

export function cooldownRemainingMs(): number {
  return Math.max(0, cooldownUntil - Date.now());
}

/**
 * Registra un 429. `retryAfterSeconds` viene dall'header Retry-After se
 * presente; in mancanza applichiamo i 60 secondi raccomandati da Lichess.
 */
export function registerRateLimit(retryAfterSeconds?: number): void {
  const waitMs = Math.min((retryAfterSeconds ?? 60) * 1000, 120_000);
  const until = Date.now() + waitMs;
  // Non accorciamo mai un cooldown già in corso.
  if (until > cooldownUntil) {
    cooldownUntil = until;
    notifyCooldown();
    // Un solo timer per far scattare la notifica di fine cooldown.
    window.setTimeout(notifyCooldown, waitMs + 50);
  }
}

export function clearRateLimit(): void {
  if (cooldownUntil !== 0) {
    cooldownUntil = 0;
    notifyCooldown();
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Esegue `task` nella corsia indicata, rispettando il cooldown globale.
 * Lo slot viene rilasciato appena `task` risolve: per le richieste HTTP questo
 * significa "appena arrivano gli header".
 */
export async function withLane<T>(lane: Lane, task: () => Promise<T>): Promise<T> {
  const semaphore = lanes[lane];
  await semaphore.acquire();
  try {
    let remaining = cooldownRemainingMs();
    while (remaining > 0) {
      await sleep(remaining);
      remaining = cooldownRemainingMs();
    }
    return await task();
  } finally {
    semaphore.release();
  }
}
