import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/store';
import { fetchNextPuzzle, solvePuzzles, type PuzzleDifficulty } from '../lichess/api';
import { humanMessage } from '../lichess/errors';
import type { Color, PuzzleResponse } from '../lichess/types';
import {
  checkColor,
  chessFromSanPgn,
  lastMoveSquares,
  legalDests,
  moveToUci,
  turnColor,
  uciToMove,
} from '../chess/rules';

/**
 * Motore di allenamento sui puzzle.
 *
 * Convenzione dei puzzle Lichess, verificata sui dati reali dell'API:
 *  - la posizione di partenza è quella dopo *tutte* le mosse di `game.pgn`;
 *  - l'ultima mossa del PGN è la mossa dell'avversario che crea il problema;
 *  - `solution` alterna: gli indici pari sono le mosse dell'utente, i dispari
 *    le risposte dell'avversario;
 *  - il colore dell'utente è quello di turno nella posizione iniziale.
 *
 * All'apertura mostriamo la posizione *precedente* all'ultima mossa del PGN e
 * poi la giochiamo con animazione: è il comportamento di Lichess, e serve a far
 * capire che cosa ha appena fatto l'avversario.
 */

export type PuzzlePhase =
  /** Animazione della mossa che imposta il problema. */
  | 'intro'
  | 'waiting'
  /** Mossa sbagliata: si può riprovare. */
  | 'failed'
  | 'solved';

export interface PuzzleTrainer {
  puzzle: PuzzleResponse | null;
  loading: boolean;
  error: string | null;
  phase: PuzzlePhase;
  /** Posizione corrente come istanza chess.js, per interrogare le regole. */
  chess: Chess;
  fen: string;
  orientation: Color;
  turn: Color;
  check: Color | undefined;
  lastMove: [Key, Key] | undefined;
  dests: Map<Key, Key[]>;
  /** Colore muovibile: undefined blocca la scacchiera. */
  movableColor: Color | undefined;
  /** Mosse dell'utente già indovinate su quelle totali richieste. */
  progress: { done: number; total: number };
  /** True se il puzzle è stato risolto senza errori. */
  flawless: boolean;
  ratingDiff: number | null;
  /** Da passare a `Board`: forza il ripristino dopo una mossa sbagliata. */
  revision: number;
  playMove: (from: Key, to: Key, promotion?: string) => void;
  /** Mostra la mossa corretta e conta il puzzle come sbagliato. */
  revealSolution: () => void;
  next: () => void;
  retry: () => void;
}

const INTRO_DELAY_MS = 450;
const OPPONENT_REPLY_DELAY_MS = 380;

export function usePuzzleTrainer(difficulty: PuzzleDifficulty = 'normal'): PuzzleTrainer {
  const authenticated = useAuth((state) => state.status === 'authenticated');

  const [puzzle, setPuzzle] = useState<PuzzleResponse | null>(null);
  const [queue, setQueue] = useState<PuzzleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<PuzzlePhase>('intro');
  /** Semimosse della soluzione già giocate (utente + avversario). */
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [ratingDiff, setRatingDiff] = useState<number | null>(null);
  /** Posizione mostrata: parte "indietro di una mossa" per l'animazione intro. */
  const [showIntro, setShowIntro] = useState(true);
  const [revision, setRevision] = useState(0);

  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const id = window.setTimeout(callback, delay);
    timersRef.current.push(id);
  }, []);

  /** Carica un puzzle: dalla coda locale se disponibile, altrimenti dall'API. */
  const load = useCallback(
    async (fromQueue?: PuzzleResponse) => {
      clearTimers();
      setPhase('intro');
      setSolutionIndex(0);
      setMistakes(0);
      setRatingDiff(null);
      setShowIntro(true);
      setError(null);

      if (fromQueue) {
        setPuzzle(fromQueue);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        setPuzzle(await fetchNextPuzzle({ difficulty }));
      } catch (loadError) {
        setError(humanMessage(loadError));
      } finally {
        setLoading(false);
      }
    },
    [clearTimers, difficulty],
  );

  // Primo caricamento e ricarica al cambio di difficoltà.
  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Posizione base del puzzle e mossa introduttiva.
   * Ricalcolata solo al cambio di puzzle: è pura derivazione dai dati.
   */
  const base = useMemo(() => {
    if (!puzzle) return null;

    const sanMoves = puzzle.game.pgn.trim().split(/\s+/).filter(Boolean);
    // Posizione finale: da qui parte il puzzle.
    const full = chessFromSanPgn(puzzle.game.pgn);
    // Posizione un semimossa prima, per animare la mossa dell'avversario.
    const beforeLast = chessFromSanPgn(sanMoves.slice(0, -1).join(' '));

    return {
      startFen: full.fen(),
      introFen: beforeLast.fen(),
      userColor: turnColor(full),
      setupMove: lastMoveSquares(full),
      sanCount: sanMoves.length,
    };
  }, [puzzle]);

  // Anima la mossa che imposta il problema, poi passa il turno all'utente.
  useEffect(() => {
    if (!base || !showIntro) return;
    schedule(() => {
      setShowIntro(false);
      setPhase('waiting');
    }, INTRO_DELAY_MS);
  }, [base, showIntro, schedule]);

  /** Posizione corrente: base + le mosse di soluzione già giocate. */
  const position = useMemo(() => {
    if (!base || !puzzle) return null;

    if (showIntro) {
      // Durante l'intro la scacchiera mostra la posizione precedente; l'effetto
      // di animazione nasce dal successivo passaggio a `startFen`.
      const chess = new Chess(base.introFen);
      return {
        chess,
        fen: base.introFen,
        turn: turnColor(chess),
        check: checkColor(chess),
        lastMove: undefined as [Key, Key] | undefined,
        dests: new Map<Key, Key[]>(),
      };
    }

    const chess = new Chess(base.startFen);
    let lastMove: [Key, Key] | undefined = base.setupMove;

    for (let index = 0; index < solutionIndex; index += 1) {
      const uci = puzzle.puzzle.solution[index];
      if (!uci) break;
      const move = uciToMove(uci);
      try {
        chess.move(move);
        lastMove = [move.from as Key, move.to as Key];
      } catch {
        break;
      }
    }

    return {
      chess,
      fen: chess.fen(),
      turn: turnColor(chess),
      check: checkColor(chess),
      lastMove,
      dests: legalDests(chess),
    };
  }, [base, puzzle, solutionIndex, showIntro]);

  // Risposta automatica dell'avversario dopo una mossa corretta dell'utente.
  useEffect(() => {
    if (!puzzle || phase !== 'waiting' || showIntro) return;

    const solution = puzzle.puzzle.solution;
    // Indici dispari = mosse dell'avversario.
    if (solutionIndex >= solution.length || solutionIndex % 2 === 0) return;

    schedule(() => setSolutionIndex((index) => index + 1), OPPONENT_REPLY_DELAY_MS);
  }, [puzzle, phase, solutionIndex, showIntro, schedule]);

  /** Registra il risultato su Lichess e mette in coda il puzzle successivo. */
  const submitResult = useCallback(
    async (win: boolean) => {
      if (!puzzle || !authenticated) return;
      try {
        const response = await solvePuzzles([{ id: puzzle.puzzle.id, win, rated: true }], {
          angle: 'mix',
          nb: 1,
        });
        const round = response.rounds?.find((item) => item.id === puzzle.puzzle.id);
        if (round) setRatingDiff(round.ratingDiff);
        if (response.puzzles?.length) setQueue(response.puzzles);
      } catch {
        // Il salvataggio del risultato non deve interrompere l'allenamento: se
        // Lichess non risponde, l'utente continua e perde solo il rating di
        // quel puzzle.
      }
    },
    [puzzle, authenticated],
  );

  const playMove = useCallback(
    (from: Key, to: Key, promotion?: string) => {
      if (!puzzle || !position || phase === 'solved') return;

      const solution = puzzle.puzzle.solution;
      const expected = solution[solutionIndex];
      if (!expected) return;

      const attempted = moveToUci({ from, to, promotion });

      // Il confronto ignora la promozione quando la soluzione non la specifica,
      // così una promozione a donna implicita resta valida.
      const matches =
        attempted === expected ||
        (promotion === undefined && attempted === expected.slice(0, 4));

      if (!matches) {
        // Una mossa che dà scacco matto è accettata anche se non è quella
        // prevista: è la regola di Lichess, e rifiutarla sarebbe sbagliato.
        const probe = new Chess(position.fen);
        try {
          probe.move({ from, to, ...(promotion ? { promotion } : {}) });
          if (probe.isCheckmate()) {
            setPhase('solved');
            void submitResult(mistakes === 0);
            return;
          }
        } catch {
          // Mossa illegale: Chessground non dovrebbe permetterla, ma non
          // possiamo escluderlo.
        }

        setMistakes((count) => count + 1);
        setPhase('failed');
        // Chessground ha già mosso il pezzo: la revision riporta la scacchiera
        // alla posizione corretta.
        setRevision((value) => value + 1);
        return;
      }

      const nextIndex = solutionIndex + 1;
      setSolutionIndex(nextIndex);

      if (nextIndex >= solution.length) {
        setPhase('solved');
        void submitResult(mistakes === 0);
      } else {
        setPhase('waiting');
      }
    },
    [puzzle, position, phase, solutionIndex, mistakes, submitResult],
  );

  const revealSolution = useCallback(() => {
    if (!puzzle) return;
    clearTimers();
    setMistakes((count) => Math.max(1, count));
    setSolutionIndex(puzzle.puzzle.solution.length);
    setPhase('solved');
    void submitResult(false);
  }, [puzzle, clearTimers, submitResult]);

  const retry = useCallback(() => {
    // Torna alla posizione dell'ultima mossa richiesta all'utente, che è
    // l'indice pari immediatamente precedente.
    clearTimers();
    setSolutionIndex((index) => index - (index % 2));
    setPhase('waiting');
    setRevision((value) => value + 1);
  }, [clearTimers]);

  const next = useCallback(() => {
    const [head, ...rest] = queue;
    setQueue(rest);
    void load(head);
  }, [queue, load]);

  const totalUserMoves = puzzle ? Math.ceil(puzzle.puzzle.solution.length / 2) : 0;
  const doneUserMoves = Math.ceil(solutionIndex / 2);

  const fallbackChess = useMemo(() => new Chess(), []);

  return {
    puzzle,
    loading,
    error,
    phase,
    chess: position?.chess ?? fallbackChess,
    fen: position?.fen ?? fallbackChess.fen(),
    orientation: base?.userColor ?? 'white',
    turn: position?.turn ?? 'white',
    check: position?.check,
    lastMove: position?.lastMove,
    dests: position?.dests ?? new Map(),
    // La scacchiera è muovibile solo quando tocca all'utente e il puzzle è
    // ancora aperto.
    movableColor:
      phase === 'waiting' && !showIntro && solutionIndex % 2 === 0 ? base?.userColor : undefined,
    progress: { done: doneUserMoves, total: totalUserMoves },
    flawless: mistakes === 0,
    ratingDiff,
    revision,
    playMove,
    revealSolution,
    next,
    retry,
  };
}
