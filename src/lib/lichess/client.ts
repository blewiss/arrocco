import { DEFAULT_TIMEOUT_MS, LICHESS_ORIGIN } from './config';
import { AuthError, LichessError, NetworkError, RateLimitError } from './errors';
import { clearRateLimit, registerRateLimit, withLane, type Lane } from './queue';

/**
 * Il token è fornito dallo store di autenticazione tramite iniezione, per non
 * creare una dipendenza circolare fra il client HTTP e lo store React.
 */
type TokenProvider = () => string | null;

let tokenProvider: TokenProvider = () => null;

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

/** Chiamato quando il server rifiuta il token: la UI deve tornare al login. */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  /** Corpo `application/x-www-form-urlencoded`: il formato usato da Lichess. */
  form?: Record<string, string | number | boolean | undefined>;
  /** `text/plain` — richiesto da alcuni endpoint (es. import PGN). */
  text?: string;
  /** Corpo `application/json` — usato dall'endpoint di soluzione dei puzzle. */
  json?: unknown;
  accept?: string;
  signal?: AbortSignal;
  /** Corsia del limiter. `serial` per gli endpoint a concorrenza 1. */
  lane?: Lane;
  /** Se true, l'assenza di token fallisce subito invece di provare anonimo. */
  requireAuth?: boolean;
  /** Gli stream long-lived non devono avere timeout. */
  noTimeout?: boolean;
}

const MAX_ATTEMPTS = 3;

function buildBody(options: RequestOptions): BodyInit | undefined {
  if (options.json !== undefined) return JSON.stringify(options.json);
  if (options.text !== undefined) return options.text;
  if (!options.form) return undefined;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options.form)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

/**
 * Richiesta a Lichess con limiter, cooldown sul 429 e errori tipizzati.
 * Restituisce la `Response` grezza: il corpo viene consumato dal chiamante,
 * così gli stream ndjson possono essere letti progressivamente.
 */
export async function apiFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const token = tokenProvider();

  if (options.requireAuth && !token) throw new AuthError(path);

  const headers: Record<string, string> = {
    Accept: options.accept ?? 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.form) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (options.text !== undefined) headers['Content-Type'] = 'text/plain';
  if (options.json !== undefined) headers['Content-Type'] = 'application/json';

  const body = buildBody(options);
  const url = path.startsWith('http') ? path : `${LICHESS_ORIGIN}${path}`;
  const lane = options.lane ?? 'default';

  let lastRateLimit: RateLimitError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // `withLane` attende l'eventuale cooldown globale prima di partire, quindi
    // un nuovo tentativo dopo un 429 è automaticamente ritardato.
    const response = await withLane(lane, async () => {
      // Il timeout è composto con l'eventuale AbortSignal del chiamante.
      const signals: AbortSignal[] = [];
      if (options.signal) signals.push(options.signal);
      if (!options.noTimeout) signals.push(AbortSignal.timeout(DEFAULT_TIMEOUT_MS));
      const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];

      try {
        return await fetch(url, {
          method: options.method ?? 'GET',
          headers,
          body,
          signal,
          // Nessun cookie: l'autenticazione è esclusivamente via Bearer token.
          credentials: 'omit',
          redirect: 'follow',
        });
      } catch (cause) {
        // Un abort richiesto dal chiamante va propagato tale e quale, per non
        // trasformare una navigazione in un finto errore di rete.
        if (options.signal?.aborted) throw cause;
        throw new NetworkError(path, cause);
      }
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
      registerRateLimit(seconds);
      lastRateLimit = new RateLimitError(path, (seconds ?? 60) * 1000);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      // Solo un token realmente rifiutato invalida la sessione; una 403 su
      // richiesta anonima significa semplicemente "serve il login".
      if (token) onUnauthorized();
      throw new AuthError(path, response.status);
    }

    if (!response.ok) {
      throw new LichessError(await describeFailure(response), response.status, path);
    }

    // Una risposta valida conferma che non siamo più in penalità.
    clearRateLimit();
    return response;
  }

  throw lastRateLimit ?? new LichessError('Troppi tentativi falliti.', 429, path);
}

/** Estrae il messaggio d'errore di Lichess, che è `{"error": "..."}` o testo. */
async function describeFailure(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return `Lichess ha risposto ${response.status}.`;
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed.error === 'string') return parsed.error;
      // Alcuni endpoint restituiscono errori per-campo: {"field": ["msg"]}
      const first = Object.values(parsed).flat().find((v) => typeof v === 'string');
      if (typeof first === 'string') return first;
    } catch {
      // Non era JSON: usa il testo così com'è, troncato.
    }
    return text.slice(0, 200);
  } catch {
    return `Lichess ha risposto ${response.status}.`;
  }
}

export async function getJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiFetch(path, { ...options, method: 'GET' });
  return (await response.json()) as T;
}

/**
 * POST verso un endpoint che risponde JSON. Lichess restituisce `{"ok":true}`
 * sulle azioni senza payload, quindi il tipo di ritorno è opzionale.
 */
export async function postJson<T = { ok: true }>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await apiFetch(path, { ...options, method: 'POST' });
  const text = await response.text();
  if (!text) return { ok: true } as T;
  return JSON.parse(text) as T;
}
