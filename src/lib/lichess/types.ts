/**
 * Tipi delle risposte Lichess usate da Arrocco.
 *
 * Sono modellati sulle shape reali degli endpoint, non sull'intera spec: i
 * campi che non consumiamo sono omessi, e quelli opzionali riflettono i casi
 * concreti (es. un giocatore ha `user` oppure `aiLevel`, mai entrambi).
 */

export type Color = 'white' | 'black';

export type Speed = 'ultraBullet' | 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence';

/** Esiti possibili di una partita secondo l'API. */
export type GameStatus =
  | 'created'
  | 'started'
  | 'aborted'
  | 'mate'
  | 'resign'
  | 'stalemate'
  | 'timeout'
  | 'draw'
  | 'outoftime'
  | 'cheat'
  | 'noStart'
  | 'unknownFinish'
  | 'variantEnd';

export interface LightUser {
  id: string;
  name: string;
  title?: string;
  patron?: boolean;
  flair?: string;
}

export interface Perf {
  games: number;
  rating: number;
  rd: number;
  prog: number;
  prov?: boolean;
}

export interface AccountUser {
  id: string;
  username: string;
  title?: string;
  patron?: boolean;
  createdAt: number;
  seenAt?: number;
  /** Chiavi come `blitz`, `rapid`, `puzzle`, `bullet`, … */
  perfs: Partial<Record<string, Perf>>;
  profile?: {
    country?: string;
    bio?: string;
    flag?: string;
    realName?: string;
  };
  playTime?: { total: number; tv: number };
  url?: string;
}

/** Un lato della partita nell'export. `aiLevel` compare al posto di `user`. */
export interface GamePlayer {
  user?: LightUser;
  rating?: number;
  ratingDiff?: number;
  aiLevel?: number;
  provisional?: boolean;
}

export interface ExportedGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: Speed;
  perf: string;
  createdAt: number;
  lastMoveAt: number;
  status: GameStatus;
  source?: string;
  players: { white: GamePlayer; black: GamePlayer };
  /** Assente in caso di patta o partita non conclusa. */
  winner?: Color;
  opening?: { eco: string; name: string; ply: number };
  /** Presente solo se richiesto con `moves=true`. */
  moves?: string;
  clock?: { initial: number; increment: number; totalTime: number };
}

/* ── Export di una singola partita ──────────────────────────────────────── */

/**
 * Giudizio di Lichess su una mossa. I nomi arrivano in inglese dall'API e
 * restano tali nei tipi: la traduzione è affare della UI.
 */
export type JudgmentName = 'Inaccuracy' | 'Mistake' | 'Blunder';

/**
 * Una voce di `analysis`, allineata **per indice** alle semimosse di `moves`:
 * `analysis[i]` giudica la mossa `i` e valuta la posizione che ne risulta.
 *
 * L'array può essere più corto delle mosse di una voce: la posizione finale di
 * una partita conclusa per matto non viene valutata. Verificato su partite
 * reali dell'API.
 */
export interface MoveAnalysis {
  /** Centipawn dal punto di vista del bianco. Assente quando c'è `mate`. */
  eval?: number;
  /** Matto in N semimosse, col segno: negativo se a mattare è il nero. */
  mate?: number;
  /** Mossa migliore in UCI. Presente solo sulle mosse giudicate. */
  best?: string;
  /** Variante consigliata, in SAN separato da spazi. */
  variation?: string;
  judgment?: { name: JudgmentName; comment: string };
}

/** Riepilogo per giocatore, presente solo se la partita è stata analizzata. */
export interface PlayerAnalysis {
  inaccuracy: number;
  mistake: number;
  blunder: number;
  /** Average centipawn loss: più basso è meglio. */
  acpl: number;
  /** Percentuale 0–100 già calcolata da Lichess. */
  accuracy?: number;
}

export interface GameExportPlayer extends GamePlayer {
  analysis?: PlayerAnalysis;
}

/**
 * Risposta di `/game/export/{id}`.
 *
 * Attenzione: qui `moves` è in **SAN** (`e4 e5 Nf3 …`), non in UCI come nello
 * stream della Board API. È la differenza che fa sbagliare la ricostruzione
 * della partita se la si dà per scontata.
 */
export interface GameExport extends Omit<ExportedGame, 'players'> {
  players: { white: GameExportPlayer; black: GameExportPlayer };
  /** Posizione di partenza, presente sulle varianti che non usano quella standard. */
  initialFen?: string;
  /** C'è solo se qualcuno ha già richiesto l'analisi su lichess.org. */
  analysis?: MoveAnalysis[];
  /** Semimosse in cui iniziano mediogioco e finale, secondo Lichess. */
  division?: { middle?: number; end?: number };
}

/* ── Puzzle ─────────────────────────────────────────────────────────────── */

export interface PuzzleData {
  id: string;
  rating: number;
  plays: number;
  /** Mosse della soluzione in formato UCI, es. `["e2e4", "e7e5"]`. */
  solution: string[];
  themes: string[];
  /** Numero di semimosse del PGN dopo cui inizia il puzzle. */
  initialPly: number;
}

export interface PuzzleGame {
  id: string;
  perf: { key: string; name: string };
  rated: boolean;
  players: Array<{ name: string; id?: string; color: Color; rating?: number; title?: string }>;
  /** PGN in notazione SAN, mosse separate da spazio, senza numerazione. */
  pgn: string;
  clock?: string;
}

export interface PuzzleResponse {
  game: PuzzleGame;
  puzzle: PuzzleData;
}

/** Riga di `/api/puzzle/activity` (ndjson, richiede scope puzzle:read). */
export interface PuzzleActivityEntry {
  date: number;
  win: boolean;
  puzzle: {
    id: string;
    fen: string;
    lastMove: string;
    plays: number;
    rating: number;
    solution: string[];
    themes: string[];
  };
}

/** `/api/puzzle/dashboard/{days}` */
export interface PuzzleDashboard {
  days: number;
  global: PuzzleThemeResults;
  themes: Record<string, { results: PuzzleThemeResults; theme: string }>;
}

export interface PuzzleThemeResults {
  firstWins: number;
  nb: number;
  performance: number;
  puzzleRatingAvg: number;
  replayWins: number;
}

/* ── Board API: stream della partita ───────────────────────────────────── */

export interface GameStateEvent {
  type: 'gameState';
  /** Tutte le mosse dall'inizio, in UCI, separate da spazio. */
  moves: string;
  wtime: number;
  btime: number;
  winc: number;
  binc: number;
  status: GameStatus;
  winner?: Color;
  wdraw?: boolean;
  bdraw?: boolean;
  wtakeback?: boolean;
  btakeback?: boolean;
}

export interface GameFullPlayer {
  id?: string;
  name?: string;
  title?: string;
  rating?: number;
  provisional?: boolean;
  aiLevel?: number;
}

export interface GameFullEvent {
  type: 'gameFull';
  id: string;
  variant: { key: string; name: string; short?: string };
  clock?: { initial: number; increment: number };
  speed: Speed;
  perf: { name?: string };
  rated: boolean;
  createdAt: number;
  white: GameFullPlayer;
  black: GameFullPlayer;
  /** `startpos` per la posizione iniziale standard, altrimenti un FEN. */
  initialFen: string;
  state: GameStateEvent;
}

export interface ChatLineEvent {
  type: 'chatLine';
  room: 'player' | 'spectator';
  username: string;
  text: string;
}

export interface OpponentGoneEvent {
  type: 'opponentGone';
  gone: boolean;
  claimWinInSeconds?: number;
}

export type BoardStreamEvent =
  | GameFullEvent
  | GameStateEvent
  | ChatLineEvent
  | OpponentGoneEvent;

/* ── Stream eventi dell'account ─────────────────────────────────────────── */

export interface EventGame {
  gameId: string;
  fullId: string;
  color: Color;
  fen: string;
  hasMoved: boolean;
  isMyTurn: boolean;
  lastMove?: string;
  opponent: { id?: string; username: string; rating?: number; ai?: number };
  perf: string;
  rated: boolean;
  secondsLeft?: number;
  source: string;
  speed: Speed;
  status: { id: number; name: GameStatus };
  variant: { key: string; name: string };
  /** Presente su gameFinish. */
  winner?: Color;
}

export interface GameStartEvent {
  type: 'gameStart';
  game: EventGame;
}

export interface GameFinishEvent {
  type: 'gameFinish';
  game: EventGame;
}

export interface ChallengeEvent {
  type: 'challenge' | 'challengeCanceled' | 'challengeDeclined';
  challenge: {
    id: string;
    status: string;
    challenger: LightUser & { rating?: number };
    destUser?: LightUser & { rating?: number };
    variant: { key: string; name: string };
    rated: boolean;
    speed: Speed;
    timeControl: { type: string; limit?: number; increment?: number; show?: string };
    color: string;
    url: string;
  };
}

export type AccountStreamEvent = GameStartEvent | GameFinishEvent | ChallengeEvent;

/** Risposta di `POST /api/challenge/ai`: la partita è già creata e in corso. */
export interface AiGameResponse {
  id: string;
  fen: string;
  player: Color;
  turns: number;
  speed: Speed;
  perf: string;
  rated: boolean;
  source: string;
}

/** Elemento di `/api/account/playing`. */
export interface NowPlayingGame {
  gameId: string;
  fullId: string;
  color: Color;
  fen: string;
  hasMoved: boolean;
  isMyTurn: boolean;
  lastMove?: string;
  opponent: { id?: string; username: string; rating?: number; ai?: number };
  perf: string;
  rated: boolean;
  secondsLeft?: number;
  speed: Speed;
  variant: { key: string; name: string };
}
