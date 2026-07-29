/** Errori tipizzati, così la UI può reagire in modo diverso a ciascun caso. */

export class LichessError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'LichessError';
  }
}

/** 401/403: token assente, scaduto o senza lo scope necessario. */
export class AuthError extends LichessError {
  constructor(path: string, status = 401) {
    super('Sessione Lichess non valida o permessi insufficienti.', status, path);
    this.name = 'AuthError';
  }
}

/** 429: rate limit. La UI mostra un avviso e il limiter gestisce l'attesa. */
export class RateLimitError extends LichessError {
  constructor(
    path: string,
    readonly retryAfterMs: number,
  ) {
    super(
      'Lichess ha applicato un limite di frequenza. Arrocco riprenderà automaticamente.',
      429,
      path,
    );
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends LichessError {
  constructor(path: string, cause?: unknown) {
    super('Impossibile raggiungere Lichess. Controlla la connessione.', 0, path);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/** Messaggio leggibile da mostrare all'utente per un errore qualunque. */
export function humanMessage(error: unknown): string {
  if (error instanceof LichessError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Si è verificato un errore inatteso.';
}
