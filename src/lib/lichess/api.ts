import { apiFetch, getJson, postJson } from './client';
import { collectNdjson, readNdjson } from './ndjson';
import type {
  AccountStreamEvent,
  AccountUser,
  AiGameResponse,
  BoardStreamEvent,
  Color,
  ExportedGame,
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
 * Export delle partite di un utente.
 *
 * Usa la corsia `serial` del limiter: questo endpoint rifiuta con 429 due
 * richieste sovrapposte, ed è il vincolo più stretto di tutta l'API.
 */
export async function exportGames({
  username,
  max,
  since,
  until,
  withMoves = false,
  withOpening = true,
  signal,
}: ExportGamesParams): Promise<ExportedGame[]> {
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
