import { useQueryClient } from '@tanstack/react-query';
import type { Chess } from 'chess.js';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { gameQueryKeys } from '../queryKeys';
import { openGameStream, playMove } from '../lichess/api';
import { humanMessage } from '../lichess/errors';
import type {
  BoardStreamEvent,
  Color,
  GameFullEvent,
  GameStateEvent,
} from '../lichess/types';
import {
  chessFromUciMoves,
  checkColor,
  lastMoveSquares,
  legalDests,
  turnColor,
} from '../chess/rules';

interface LiveGameState {
  full: GameFullEvent | null;
  state: GameStateEvent | null;
  /** Momento in cui sono arrivati gli orologi: base per il tick locale. */
  clockSyncedAt: number;
  opponentGone: boolean;
  claimWinInSeconds: number | null;
  connection: 'connecting' | 'live' | 'closed' | 'error';
  error: string | null;
}

type Action =
  | { type: 'full'; event: GameFullEvent }
  | { type: 'state'; event: GameStateEvent }
  | { type: 'opponentGone'; gone: boolean; claimWinInSeconds?: number }
  | { type: 'connection'; value: LiveGameState['connection'] }
  | { type: 'error'; message: string }
  | { type: 'reset' };

const INITIAL: LiveGameState = {
  full: null,
  state: null,
  clockSyncedAt: 0,
  opponentGone: false,
  claimWinInSeconds: null,
  connection: 'connecting',
  error: null,
};

function reducer(current: LiveGameState, action: Action): LiveGameState {
  switch (action.type) {
    case 'full':
      return {
        ...current,
        full: action.event,
        state: action.event.state,
        clockSyncedAt: Date.now(),
        connection: 'live',
        error: null,
      };
    case 'state':
      return {
        ...current,
        state: action.event,
        clockSyncedAt: Date.now(),
        connection: 'live',
      };
    case 'opponentGone':
      return {
        ...current,
        opponentGone: action.gone,
        claimWinInSeconds: action.claimWinInSeconds ?? null,
      };
    case 'connection':
      return { ...current, connection: action.value };
    case 'error':
      return { ...current, connection: 'error', error: action.message };
    case 'reset':
      return INITIAL;
  }
}

/** Stati in cui la partita è finita e non si può più muovere. */
function isFinished(state: GameStateEvent | null): boolean {
  if (!state) return false;
  return state.status !== 'started' && state.status !== 'created';
}

export interface LiveGame {
  full: GameFullEvent | null;
  state: GameStateEvent | null;
  /** Istante dell'ultima sincronizzazione degli orologi col server. */
  clockSyncedAt: number;
  connection: LiveGameState['connection'];
  error: string | null;
  opponentGone: boolean;
  claimWinInSeconds: number | null;
  /** Il colore giocato dall'utente, null finché il gameFull non è arrivato. */
  myColor: Color | null;
  finished: boolean;
  /** Posizione corrente come istanza chess.js, per interrogare le regole. */
  chess: Chess;
  fen: string;
  turn: Color;
  check: Color | undefined;
  lastMove: ReturnType<typeof lastMoveSquares>;
  dests: ReturnType<typeof legalDests>;
  sanMoves: string[];
  /** Semimosse giocate. */
  ply: number;
  /** True se è il turno dell'utente e la partita è in corso. */
  myTurn: boolean;
  sendMove: (uci: string) => Promise<void>;
  /**
   * Da passare a `Board`: incrementa quando il server rifiuta una mossa, per
   * annullare l'anteprima locale che Chessground ha già applicato.
   */
  revision: number;
}

/**
 * Segue una partita in corso tramite lo stream della Board API.
 *
 * Lo stream invia sempre l'elenco completo delle mosse dall'inizio, non un
 * delta: ricostruiamo quindi la posizione da zero a ogni evento. È più robusto
 * di applicare incrementi, perché un evento perso non desincronizza nulla.
 */
export function useLiveGame(gameId: string | undefined, myUserId: string | undefined): LiveGame {
  const [store, dispatch] = useReducer(reducer, INITIAL);
  const [revision, setRevision] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!gameId) return;

    dispatch({ type: 'reset' });
    const controller = new AbortController();

    void (async () => {
      try {
        const stream = await openGameStream(gameId, controller.signal);
        for await (const event of stream) {
          if (controller.signal.aborted) return;
          route(event, dispatch);
        }
        // Lo stream si chiude normalmente a partita finita.
        if (!controller.signal.aborted) dispatch({ type: 'connection', value: 'closed' });
      } catch (error) {
        // Un abort è la conseguenza attesa dello smontaggio: non è un errore.
        if (controller.signal.aborted) return;
        dispatch({ type: 'error', message: humanMessage(error) });
      }
    })();

    return () => controller.abort();
  }, [gameId]);

  const myColor = useMemo<Color | null>(() => {
    if (!store.full || !myUserId) return null;
    const target = myUserId.toLowerCase();
    if (store.full.white.id?.toLowerCase() === target) return 'white';
    if (store.full.black.id?.toLowerCase() === target) return 'black';
    return null;
  }, [store.full, myUserId]);

  // La posizione viene derivata dalle mosse: unica fonte di verità è lo stream.
  const position = useMemo(() => {
    const moves = store.state?.moves ?? '';
    const chess = chessFromUciMoves(moves, store.full?.initialFen);
    const sanMoves = chess.history();
    return {
      chess,
      fen: chess.fen(),
      turn: turnColor(chess),
      check: checkColor(chess),
      lastMove: lastMoveSquares(chess),
      dests: legalDests(chess),
      sanMoves,
      ply: sanMoves.length,
    };
  }, [store.state?.moves, store.full?.initialFen]);

  const finished = isFinished(store.state);
  const myTurn = !finished && myColor !== null && position.turn === myColor;

  // Appena la partita si chiude, lo storico su Lichess è cambiato: senza
  // questa invalidazione home, heatmap e archivio continuerebbero a mostrare
  // la copia in cache — cioè la situazione *prima* della partita appena
  // giocata — finché non scade lo staleTime. Vale anche per l'elenco delle
  // partite in corso, da cui questa è appena uscita.
  useEffect(() => {
    if (!finished) return;
    void queryClient.invalidateQueries({ queryKey: gameQueryKeys.all });
    void queryClient.invalidateQueries({ queryKey: gameQueryKeys.playing });
  }, [finished, queryClient]);

  const sendMove = useCallback(
    async (uci: string) => {
      if (!gameId) return;
      try {
        await playMove(gameId, uci);
      } catch (error) {
        // Chessground ha già mostrato la mossa: bumpando la revision la
        // scacchiera torna allo stato dello stream, che è l'unica autorità.
        setRevision((value) => value + 1);
        throw error;
      }
    },
    [gameId],
  );

  return {
    full: store.full,
    state: store.state,
    clockSyncedAt: store.clockSyncedAt,
    connection: store.connection,
    error: store.error,
    opponentGone: store.opponentGone,
    claimWinInSeconds: store.claimWinInSeconds,
    myColor,
    finished,
    ...position,
    myTurn,
    sendMove,
    revision,
  };
}

function route(event: BoardStreamEvent, dispatch: (action: Action) => void): void {
  switch (event.type) {
    case 'gameFull':
      dispatch({ type: 'full', event });
      break;
    case 'gameState':
      dispatch({ type: 'state', event });
      break;
    case 'opponentGone':
      dispatch({
        type: 'opponentGone',
        gone: event.gone,
        claimWinInSeconds: event.claimWinInSeconds,
      });
      break;
    case 'chatLine':
      // La chat non è nella v1: ignorata senza rumore.
      break;
  }
}

export interface ClockReadout {
  white: number;
  black: number;
  /** Colore il cui orologio sta effettivamente scorrendo, se ce n'è uno. */
  running: Color | null;
}

/**
 * Orologi con tick locale fra due eventi dello stream.
 *
 * Lichess invia i tempi residui a ogni mossa; nell'intervallo li scaliamo
 * localmente per il giocatore di turno, così il countdown è fluido invece di
 * saltare a scatti di una mossa. Il tempo autorevole resta quello del server:
 * ogni evento risincronizza.
 *
 * Il tick parte dalla seconda semimossa, perché è da lì che l'orologio di
 * Lichess inizia davvero a correre (la prima mossa è "gratis" per entrambi).
 */
export function useTickingClock(game: LiveGame): ClockReadout | null {
  const { state, clockSyncedAt, turn, ply, finished } = game;

  // Un contatore che avanza forza il re-render mentre l'orologio scorre.
  const [, tick] = useReducer((count: number) => count + 1, 0);
  const running = Boolean(state) && !finished && ply >= 2;

  useEffect(() => {
    if (!running) return;
    // 100ms dà un decimo di secondo di risoluzione, sufficiente per un
    // countdown percepito come fluido anche sotto i 10 secondi.
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [running]);

  if (!state) return null;

  const elapsed = running ? Math.max(0, Date.now() - clockSyncedAt) : 0;

  return {
    white: Math.max(0, state.wtime - (running && turn === 'white' ? elapsed : 0)),
    black: Math.max(0, state.btime - (running && turn === 'black' ? elapsed : 0)),
    running: running ? turn : null,
  };
}
