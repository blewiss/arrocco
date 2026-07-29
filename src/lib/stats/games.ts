import type { Color, ExportedGame, GamePlayer, GameStatus } from '../lichess/types';

export type GameOutcome = 'win' | 'loss' | 'draw' | 'unfinished';

/** Il colore giocato dall'utente, o null se non ha partecipato alla partita. */
export function colorOf(game: ExportedGame, userId: string): Color | null {
  const target = userId.toLowerCase();
  if (game.players.white.user?.id.toLowerCase() === target) return 'white';
  if (game.players.black.user?.id.toLowerCase() === target) return 'black';
  return null;
}

/** Stati in cui la partita non ha prodotto un risultato valido. */
const NON_RESULT_STATUSES: ReadonlySet<GameStatus> = new Set<GameStatus>([
  'created',
  'started',
  'aborted',
  'noStart',
]);

export function outcomeOf(game: ExportedGame, userId: string): GameOutcome {
  if (NON_RESULT_STATUSES.has(game.status)) return 'unfinished';
  const color = colorOf(game, userId);
  if (!color) return 'unfinished';
  // Nessun vincitore su una partita conclusa significa patta (stalemate,
  // draw, o fine per materiale insufficiente).
  if (!game.winner) return 'draw';
  return game.winner === color ? 'win' : 'loss';
}

export interface WinRateSummary {
  wins: number;
  losses: number;
  draws: number;
  /** Partite valide considerate: esclude abortite e in corso. */
  total: number;
  /** Percentuale 0–100 arrotondata. Le patte contano mezzo punto. */
  winRate: number;
  /** Percentuale di sole vittorie sul totale, senza contare le patte. */
  pureWinRate: number;
}

/**
 * Win rate sull'insieme di partite fornito.
 *
 * `winRate` usa la convenzione scacchistica del punteggio (patta = ½), che è
 * la misura sensata della performance; `pureWinRate` è la percentuale grezza
 * di vittorie, utile da mostrare a fianco.
 */
export function summarizeWinRate(games: readonly ExportedGame[], userId: string): WinRateSummary {
  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const game of games) {
    switch (outcomeOf(game, userId)) {
      case 'win':
        wins += 1;
        break;
      case 'loss':
        losses += 1;
        break;
      case 'draw':
        draws += 1;
        break;
      case 'unfinished':
        break;
    }
  }

  const total = wins + losses + draws;
  return {
    wins,
    losses,
    draws,
    total,
    winRate: total === 0 ? 0 : Math.round(((wins + draws / 2) / total) * 100),
    pureWinRate: total === 0 ? 0 : Math.round((wins / total) * 100),
  };
}

/** Etichetta dell'avversario: nome utente, oppure "Stockfish livello N". */
export function opponentLabel(game: ExportedGame, userId: string): string {
  const color = colorOf(game, userId);
  const opponent: GamePlayer =
    color === 'white' ? game.players.black : game.players.white;

  if (opponent.aiLevel !== undefined) return `Stockfish liv. ${opponent.aiLevel}`;
  return opponent.user?.name ?? 'Anonimo';
}

export function opponentRating(game: ExportedGame, userId: string): number | null {
  const color = colorOf(game, userId);
  const opponent = color === 'white' ? game.players.black : game.players.white;
  return opponent.rating ?? null;
}

/** Variazione di rating dell'utente in questa partita, se disponibile. */
export function ratingDiffOf(game: ExportedGame, userId: string): number | null {
  const color = colorOf(game, userId);
  if (!color) return null;
  return game.players[color].ratingDiff ?? null;
}

/** Descrizione in italiano del motivo di conclusione. */
export function statusLabel(status: GameStatus, winner: Color | undefined): string {
  switch (status) {
    case 'mate':
      return 'Scacco matto';
    case 'resign':
      return winner ? 'Abbandono' : 'Abbandonata';
    case 'stalemate':
      return 'Stallo';
    case 'timeout':
      return 'Tempo scaduto';
    case 'outoftime':
      return 'Tempo scaduto';
    case 'draw':
      return 'Patta';
    case 'cheat':
      return 'Partita annullata';
    case 'aborted':
      return 'Annullata';
    case 'noStart':
      return 'Mai iniziata';
    case 'variantEnd':
      return 'Fine variante';
    case 'started':
      return 'In corso';
    case 'created':
      return 'In attesa';
    case 'unknownFinish':
      return 'Conclusa';
  }
}

const SPEED_LABELS: Record<string, string> = {
  ultraBullet: 'UltraBullet',
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classica',
  correspondence: 'Corrispondenza',
};

export function speedLabel(speed: string): string {
  return SPEED_LABELS[speed] ?? speed;
}

/** Controllo di tempo leggibile, es. `5+3`. */
export function timeControlLabel(game: ExportedGame): string {
  if (!game.clock) return speedLabel(game.speed);
  const minutes = game.clock.initial / 60;
  // I tempi sotto il minuto vanno mostrati come frazione (es. ½+0 per 30s).
  const initial = minutes < 1 ? `${game.clock.initial}s` : String(minutes);
  return `${initial}+${game.clock.increment}`;
}
