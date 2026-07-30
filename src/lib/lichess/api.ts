import { apiFetch, getJson, postJson } from './client';
import { LichessError } from './errors';
import { collectNdjson, readNdjson } from './ndjson';
import type {
  AccountStreamEvent,
  AccountUser,
  AiGameResponse,
  BoardStreamEvent,
  Color,
  ExportedGame,
  GameExport,
  NowPlayingGame,
  PuzzleActivityEntry,
  PuzzleDashboard,
  PuzzleResponse,
} from './types';

/* ── Account ────────────────────────────────────────────────────────────── */

export function fetchAccount(signal?: AbortSignal): Promise<AccountUser> {
  return getJson<AccountUser>('/api/account', { requireAuth: true, signal });
}

export function fetchNowPlaying(signal?: AbortSignal): Promise<{ nowPlaying: NowPlayingGame[] }> {
  return getJson<{ nowPlaying: NowPlayingGame[] }>('/api/account/playing', {
    requireAuth: true,
    signal,
  });
}

/* ── Partite ────────────────────────────────────────────────────────────── */

export interface ExportGamesParams {
  username: string;
  max?: number;
  /** Timestamp ms: scarica solo le partite successive. */
  since?: number;
  until?: number;
  /** Le mosse pesano molto sulla risposta: richiederle solo se servono. */
  withMoves?: boolean;
  withOpening?: boolean;
  signal?: AbortSignal;
}

/**
 * Coda che serializza gli export dal primo byte all'ultima riga letta.
 *
 * La corsia `serial` del limiter da sola non basta: rilascia lo slot appena
 * arrivano gli header, mentre per Lichess la richiesta è plausibilmente ancora
 * in corso finché non ha finito di inviare il corpo — e con centinaia di
 * partite lo streaming ndjson dura secondi. Due export ravvicinati (la home e
 * l'archivio, o un refetch mentre il primo sta ancora scaricando) rischiano
 * quindi di sovrapporsi lato server e far scattare il 429 "Please only run
 * 1 request(s) at a time", con la penalità prolungata che ne segue: da lì in
 * poi *solo* lo storico partite smette di aggiornarsi, perché è l'unico a
 * passare da questo endpoint. Accodare fino all'ultima riga letta costa poco
 * e toglie di mezzo l'ipotesi.
 */
let exportChain: Promise<unknown> = Promise.resolve();

/**
 * Export delle partite di un utente.
 *
 * Usa la corsia `serial` del limiter ed è ulteriormente accodato: questo
 * endpoint rifiuta con 429 due richieste sovrapposte, ed è il vincolo più
 * stretto di tutta l'API.
 */
export function exportGames(params: ExportGamesParams): Promise<ExportedGame[]> {
  // `catch` sul predecessore: un export fallito non deve bloccare i successivi.
  const result = exportChain.then(
    () => runExport(params),
    () => runExport(params),
  );
  exportChain = result.catch(() => {});
  return result;
}

async function runExport({
  username,
  max,
  since,
  until,
  withMoves = false,
  withOpening = true,
  signal,
}: ExportGamesParams): Promise<ExportedGame[]> {
  // Chi ha annullato mentre era in coda non deve occupare il turno.
  signal?.throwIfAborted();

  const query = new URLSearchParams();
  if (max !== undefined) query.set('max', String(max));
  if (since !== undefined) query.set('since', String(since));
  if (until !== undefined) query.set('until', String(until));
  query.set('moves', String(withMoves));
  query.set('opening', String(withOpening));
  // `lastFen` e `evals` sono costosi e non usati: esclusi esplicitamente.
  query.set('evals', 'false');
  query.set('clocks', 'false');

  const response = await apiFetch(
    `/api/games/user/${encodeURIComponent(username)}?${query.toString()}`,
    {
      accept: 'application/x-ndjson',
      lane: 'serial',
      // L'export può essere lungo: il limite di 20s non si applica.
      noTimeout: true,
      signal,
    },
  );

  return collectNdjson<ExportedGame>(response, signal);
}

/**
 * Export di una singola partita, con mosse ed eventuale analisi.
 *
 * Usa l'endpoint *bulk* con un solo id, e non `GET /game/export/{id}`, che pure
 * restituirebbe esattamente la stessa cosa. Il motivo è una trappola CORS
 * verificata sull'API in produzione:
 *
 *   - `GET /game/export/{id}` risponde 200 **con** gli header CORS corretti,
 *     ma la **preflight OPTIONS sulla stessa URL risponde 404 senza header**.
 *     Sta fuori da `/api`, e la gestione delle preflight di Lichess è agganciata
 *     a `/api/*`. Finché la richiesta è "semplice" passa; appena si aggiunge
 *     `Authorization` — cioè sempre, per un utente autenticato — il browser fa
 *     la preflight e la blocca.
 *   - `POST /api/games/export/_ids` risponde 204 alla preflight ed è quindi
 *     utilizzabile da browser in ogni condizione.
 *
 * Da qui la regola generale: **da Arrocco si chiamano solo rotte sotto `/api`**.
 *
 * Altri due dettagli che vale la pena fissare:
 *  - `moves` arriva in **SAN**, non in UCI come nello stream della Board API;
 *  - `evals` e `accuracy` non fanno calcolare niente a Lichess. Restituiscono
 *    l'analisi *se* qualcuno l'ha già richiesta per questa partita su
 *    lichess.org; altrimenti i campi semplicemente non compaiono. Non esiste
 *    un endpoint pubblico per richiederla, quindi è un di più opportunistico.
 */
export async function fetchGame(gameId: string, signal?: AbortSignal): Promise<GameExport> {
  const query = new URLSearchParams({
    moves: 'true',
    evals: 'true',
    accuracy: 'true',
    opening: 'true',
    division: 'true',
    // Il PGN dentro il JSON duplicherebbe `moves` senza aggiungere nulla.
    pgnInJson: 'false',
    clocks: 'false',
    literate: 'false',
  });

  const path = `/api/games/export/_ids?${query.toString()}`;
  const response = await apiFetch(path, {
    method: 'POST',
    accept: 'application/x-ndjson',
    // Il corpo è l'elenco degli id separati da virgola: qui uno solo.
    // `text/plain` è anche il Content-Type che non complica la preflight.
    text: gameId,
    signal,
  });

  const [game] = await collectNdjson<GameExport>(response, signal);
  // Un id inesistente non è un errore HTTP: lo stream torna semplicemente vuoto.
  if (!game) throw new LichessError('Partita non trovata su Lichess.', 404, path);
  return game;
}

/* ── Puzzle ─────────────────────────────────────────────────────────────── */

export type PuzzleDifficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest';

export interface NextPuzzleParams {
  angle?: string;
  difficulty?: PuzzleDifficulty;
  signal?: AbortSignal;
}

export function fetchNextPuzzle({
  angle,
  difficulty,
  signal,
}: NextPuzzleParams = {}): Promise<PuzzleResponse> {
  const query = new URLSearchParams();
  if (angle) query.set('angle', angle);
  if (difficulty) query.set('difficulty', difficulty);
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return getJson<PuzzleResponse>(`/api/puzzle/next${suffix}`, { signal });
}

export function fetchDailyPuzzle(signal?: AbortSignal): Promise<PuzzleResponse> {
  return getJson<PuzzleResponse>('/api/puzzle/daily', { signal });
}

/**
 * Storico puzzle, dal più recente. Richiede scope `puzzle:read`.
 * `max` è essenziale: senza limite lo stream copre l'intera cronologia.
 */
export async function fetchPuzzleActivity(
  max: number,
  signal?: AbortSignal,
): Promise<PuzzleActivityEntry[]> {
  const response = await apiFetch(`/api/puzzle/activity?max=${max}`, {
    accept: 'application/x-ndjson',
    requireAuth: true,
    lane: 'serial',
    noTimeout: true,
    signal,
  });
  return collectNdjson<PuzzleActivityEntry>(response, signal);
}

export function fetchPuzzleDashboard(days: number, signal?: AbortSignal): Promise<PuzzleDashboard> {
  return getJson<PuzzleDashboard>(`/api/puzzle/dashboard/${days}`, {
    requireAuth: true,
    signal,
  });
}

export interface SolvedPuzzle {
  id: string;
  win: boolean;
  rated: boolean;
}

export interface PuzzleSolveResponse {
  /** Nuovo lotto di puzzle, se richiesto con `nb > 0`. */
  puzzles?: PuzzleResponse[];
  rounds?: Array<{ id: string; win: boolean; ratingDiff: number }>;
  glicko?: { rating: number; deviation: number };
}

/**
 * Registra i puzzle risolti e aggiorna il rating. Richiede `puzzle:write`.
 *
 * Con `nb=1` la stessa richiesta restituisce anche il puzzle successivo: una
 * chiamata invece di due, che è il motivo per cui Arrocco usa questo endpoint
 * al posto di `/api/puzzle/next` durante l'allenamento.
 */
export function solvePuzzles(
  solutions: SolvedPuzzle[],
  { angle = 'mix', nb = 1 }: { angle?: string; nb?: number } = {},
): Promise<PuzzleSolveResponse> {
  return postJson<PuzzleSolveResponse>(`/api/puzzle/batch/${angle}?nb=${nb}`, {
    requireAuth: true,
    json: { solutions },
  });
}

/* ── Creazione partite ──────────────────────────────────────────────────── */

export interface AiChallengeParams {
  level: number;
  /** Minuti iniziali. Omesso insieme a `increment` per una corrispondenza. */
  clockLimitSeconds?: number;
  clockIncrementSeconds?: number;
  color?: 'white' | 'black' | 'random';
}

export function createAiGame({
  level,
  clockLimitSeconds,
  clockIncrementSeconds,
  color = 'random',
}: AiChallengeParams): Promise<AiGameResponse> {
  return postJson<AiGameResponse>('/api/challenge/ai', {
    requireAuth: true,
    form: {
      level,
      color,
      variant: 'standard',
      'clock.limit': clockLimitSeconds,
      'clock.increment': clockIncrementSeconds,
    },
  });
}

export interface SeekParams {
  rated: boolean;
  /** Minuti iniziali (l'endpoint seek usa minuti, non secondi). */
  timeMinutes: number;
  incrementSeconds: number;
  ratingRange?: string;
  signal?: AbortSignal;
}

/**
 * Cerca un avversario umano nella lobby.
 *
 * Attenzione: questo endpoint è deliberatamente long-lived. La richiesta resta
 * aperta finché un avversario non viene trovato (o finché non la annulliamo),
 * e la partita arriva come evento `gameStart` sullo stream dell'account, non
 * come corpo di questa risposta. Va quindi chiamato senza timeout e abbinato
 * a `streamAccountEvents`.
 */
export async function createSeek({
  rated,
  timeMinutes,
  incrementSeconds,
  ratingRange,
  signal,
}: SeekParams): Promise<void> {
  const response = await apiFetch('/api/board/seek', {
    method: 'POST',
    requireAuth: true,
    accept: 'application/x-ndjson',
    noTimeout: true,
    signal,
    form: {
      rated,
      time: timeMinutes,
      increment: incrementSeconds,
      variant: 'standard',
      ratingRange,
    },
  });

  // Il corpo è uno stream di keep-alive privo di informazione: lo consumiamo
  // solo per tenere aperta la richiesta, che è ciò che mantiene attiva la
  // ricerca lato Lichess.
  for await (const _keepAlive of readNdjson<unknown>(response, signal)) {
    void _keepAlive;
  }
}

/* ── Board API: giocare ─────────────────────────────────────────────────── */

/** Stream dello stato di una partita. Non ha timeout: dura quanto la partita. */
export async function openGameStream(
  gameId: string,
  signal: AbortSignal,
): Promise<AsyncGenerator<BoardStreamEvent, void, undefined>> {
  const response = await apiFetch(`/api/board/game/stream/${gameId}`, {
    accept: 'application/x-ndjson',
    requireAuth: true,
    noTimeout: true,
    signal,
  });
  return readNdjson<BoardStreamEvent>(response, signal);
}

/** Stream degli eventi dell'account: inizio/fine partite e sfide. */
export async function streamAccountEvents(
  signal: AbortSignal,
): Promise<AsyncGenerator<AccountStreamEvent, void, undefined>> {
  const response = await apiFetch('/api/stream/event', {
    accept: 'application/x-ndjson',
    requireAuth: true,
    noTimeout: true,
    signal,
  });
  return readNdjson<AccountStreamEvent>(response, signal);
}

/**
 * Invia una mossa in formato UCI (es. `e2e4`, `e7e8q` per la promozione).
 * `offeringDraw` permette di proporre patta contestualmente alla mossa.
 */
export function playMove(gameId: string, uci: string, offeringDraw?: boolean): Promise<{ ok: true }> {
  const query = offeringDraw === undefined ? '' : `?offeringDraw=${offeringDraw}`;
  return postJson(`/api/board/game/${gameId}/move/${uci}${query}`, { requireAuth: true });
}

export function resignGame(gameId: string): Promise<{ ok: true }> {
  return postJson(`/api/board/game/${gameId}/resign`, { requireAuth: true });
}

/** Abbandonare è possibile solo prima che entrambi abbiano mosso. */
export function abortGame(gameId: string): Promise<{ ok: true }> {
  return postJson(`/api/board/game/${gameId}/abort`, { requireAuth: true });
}

export function handleDraw(gameId: string, accept: boolean): Promise<{ ok: true }> {
  return postJson(`/api/board/game/${gameId}/draw/${accept ? 'yes' : 'no'}`, {
    requireAuth: true,
  });
}

export function handleTakeback(gameId: string, accept: boolean): Promise<{ ok: true }> {
  return postJson(`/api/board/game/${gameId}/takeback/${accept ? 'yes' : 'no'}`, {
    requireAuth: true,
  });
}

/** Rivendica la vittoria quando l'avversario ha abbandonato la partita. */
export function claimVictory(gameId: string): Promise<{ ok: true }> {
  return postJson(`/api/board/game/${gameId}/claim-victory`, { requireAuth: true });
}

export function sendChat(gameId: string, text: string): Promise<{ ok: true }> {
  return postJson(`/api/board/game/${gameId}/chat`, {
    requireAuth: true,
    form: { room: 'player', text },
  });
}

export type { Color };
