import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import type { Color } from '../lichess/types';

/**
 * Ponte fra chess.js (regole, SAN, FEN) e Chessground (rendering).
 *
 * I due parlano linguaggi diversi: Lichess usa UCI (`e2e4`, `e7e8q`),
 * Chessground usa coppie di caselle, chess.js usa oggetti e SAN. Tutte le
 * conversioni stanno qui, così il resto dell'app ne ignora i dettagli.
 */

export type Dests = Map<Key, Key[]>;

/** Mosse legali nel formato atteso da Chessground. */
export function legalDests(chess: Chess): Dests {
  const dests: Dests = new Map();
  for (const move of chess.moves({ verbose: true })) {
    const from = move.from as Key;
    const existing = dests.get(from);
    if (existing) existing.push(move.to as Key);
    else dests.set(from, [move.to as Key]);
  }
  return dests;
}

export function turnColor(chess: Chess): Color {
  return chess.turn() === 'w' ? 'white' : 'black';
}

/** Il colore sotto scacco, oppure undefined: è ciò che Chessground si aspetta. */
export function checkColor(chess: Chess): Color | undefined {
  return chess.isCheck() ? turnColor(chess) : undefined;
}

/** Ultima mossa come coppia di caselle, per l'evidenziazione. */
export function lastMoveSquares(chess: Chess): [Key, Key] | undefined {
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  if (!last) return undefined;
  return [last.from as Key, last.to as Key];
}

/**
 * Applica una sequenza di mosse UCI a una posizione di partenza.
 * È il modo in cui ricostruiamo lo stato dallo stream della Board API, che
 * invia sempre l'elenco completo delle mosse dall'inizio.
 */
export function chessFromUciMoves(moves: string, initialFen?: string): Chess {
  const chess = initialFen && initialFen !== 'startpos' ? new Chess(initialFen) : new Chess();
  for (const uci of moves.split(' ')) {
    if (!uci) continue;
    try {
      chess.move(uciToMove(uci));
    } catch {
      // Una mossa non applicabile significa che il nostro stato è divergente
      // dal server. Interrompiamo qui invece di propagare una posizione errata:
      // il prossimo evento dello stream ricostruirà tutto da zero.
      break;
    }
  }
  return chess;
}

export interface MoveInput {
  from: string;
  to: string;
  promotion?: string;
}

/** `e7e8q` → `{ from: 'e7', to: 'e8', promotion: 'q' }` */
export function uciToMove(uci: string): MoveInput {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

export function moveToUci({ from, to, promotion }: MoveInput): string {
  return `${from}${to}${promotion ?? ''}`;
}

/**
 * Verifica se una mossa richiede la scelta del pezzo di promozione.
 * Va chiamata *prima* di inviare la mossa, perché la scelta cambia l'UCI.
 */
export function isPromotion(chess: Chess, from: string, to: string): boolean {
  const piece = chess.get(from as never);
  if (!piece || piece.type !== 'p') return false;
  const targetRank = to.charAt(1);
  return (piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1');
}

/** Mosse in SAN raggruppate a coppie, per la lista mosse. */
export interface MovePair {
  number: number;
  white?: string;
  black?: string;
}

export function toMovePairs(sanMoves: readonly string[]): MovePair[] {
  const pairs: MovePair[] = [];
  for (let index = 0; index < sanMoves.length; index += 2) {
    pairs.push({
      number: index / 2 + 1,
      white: sanMoves[index],
      black: sanMoves[index + 1],
    });
  }
  return pairs;
}

/** Una posizione attraversata dalla partita, con la mossa che l'ha prodotta. */
export interface ReplayPosition {
  /** 0 = posizione iniziale, N = dopo l'N-esima semimossa. */
  ply: number;
  fen: string;
  /** SAN della mossa che ha portato qui. Assente solo sulla posizione 0. */
  san?: string;
  /** Caselle da evidenziare, per Chessground. */
  lastMove?: [Key, Key];
  check?: Color;
  /** Colore che deve muovere in questa posizione. */
  turn: Color;
}

/**
 * Riproduce una partita da mosse SAN e restituisce **ogni** posizione
 * attraversata, non solo quella finale: è ciò che serve per navigare avanti e
 * indietro nello storico senza ricalcolare nulla a ogni click.
 *
 * L'indice nell'array coincide col ply, quindi l'array ha sempre un elemento
 * in più delle mosse. Il formato SAN è quello di `/game/export/{id}`; lo
 * stream della Board API usa invece UCI, vedi `chessFromUciMoves`.
 */
export function replaySanMoves(moves: string, initialFen?: string): ReplayPosition[] {
  const chess = initialFen && initialFen !== 'startpos' ? new Chess(initialFen) : new Chess();

  const positions: ReplayPosition[] = [
    { ply: 0, fen: chess.fen(), turn: turnColor(chess), check: checkColor(chess) },
  ];

  for (const san of moves.trim().split(/\s+/)) {
    if (!san) continue;
    try {
      const move = chess.move(san);
      positions.push({
        ply: positions.length,
        fen: chess.fen(),
        san: move.san,
        lastMove: [move.from as Key, move.to as Key],
        check: checkColor(chess),
        turn: turnColor(chess),
      });
    } catch {
      // Una mossa non applicabile interrompe la ricostruzione: meglio una
      // partita troncata, e visibilmente tale, che posizioni sbagliate.
      break;
    }
  }

  return positions;
}

/**
 * Ricostruisce le mosse SAN a partire dal PGN "nudo" dei puzzle, che è una
 * sequenza di SAN separata da spazi senza numerazione né intestazioni.
 */
export function chessFromSanPgn(pgn: string): Chess {
  const chess = new Chess();
  for (const san of pgn.trim().split(/\s+/)) {
    if (!san) continue;
    try {
      chess.move(san);
    } catch {
      break;
    }
  }
  return chess;
}
