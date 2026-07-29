import { useCallback, useEffect, useRef, useState } from 'react';
import { createSeek, streamAccountEvents, type SeekParams } from '../lichess/api';
import { humanMessage } from '../lichess/errors';

export type SeekStatus = 'idle' | 'searching' | 'matched' | 'error';

export interface SeekController {
  status: SeekStatus;
  error: string | null;
  /** Secondi trascorsi dall'inizio della ricerca. */
  elapsedSeconds: number;
  start: (params: Omit<SeekParams, 'signal'>) => void;
  cancel: () => void;
}

/**
 * Ricerca di un avversario umano nella lobby di Lichess.
 *
 * Il protocollo è particolare e vale spiegarlo: `POST /api/board/seek` non
 * restituisce la partita. Resta invece appesa, e *è la richiesta aperta stessa*
 * a mantenere attiva l'inserzione nella lobby — chiudere la connessione ritira
 * la ricerca. La partita arriva separatamente, come evento `gameStart` sullo
 * stream dell'account.
 *
 * Servono quindi due connessioni simultanee, ed entrambe vanno chiuse quando
 * l'utente annulla o abbandona la pagina.
 */
export function useSeek(onGameStart: (gameId: string) => void): SeekController {
  const [status, setStatus] = useState<SeekStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const seekControllerRef = useRef<AbortController | null>(null);
  const eventsControllerRef = useRef<AbortController | null>(null);

  // Il callback in un ref: `start` non deve cambiare identità a ogni render del
  // componente chiamante, altrimenti gli effetti a valle si ri-eseguono.
  const onGameStartRef = useRef(onGameStart);
  onGameStartRef.current = onGameStart;

  const teardown = useCallback(() => {
    seekControllerRef.current?.abort();
    eventsControllerRef.current?.abort();
    seekControllerRef.current = null;
    eventsControllerRef.current = null;
  }, []);

  // Chiudere entrambe le connessioni allo smontaggio è indispensabile: una
  // ricerca lasciata aperta continuerebbe ad accoppiare l'utente a partite che
  // non sta più aspettando.
  useEffect(() => teardown, [teardown]);

  useEffect(() => {
    if (status !== 'searching') return;
    const interval = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  const start = useCallback(
    (params: Omit<SeekParams, 'signal'>) => {
      teardown();
      setStatus('searching');
      setError(null);
      setElapsedSeconds(0);

      const seekController = new AbortController();
      const eventsController = new AbortController();
      seekControllerRef.current = seekController;
      eventsControllerRef.current = eventsController;

      // Lo stream eventi va aperto per primo: se lo aprissimo dopo il seek,
      // una partita trovata immediatamente potrebbe sfuggirci.
      void (async () => {
        try {
          const stream = await streamAccountEvents(eventsController.signal);
          for await (const event of stream) {
            if (eventsController.signal.aborted) return;
            if (event.type === 'gameStart') {
              setStatus('matched');
              // La ricerca ha avuto successo: chiudiamo tutto prima di navigare.
              teardown();
              onGameStartRef.current(event.game.gameId);
              return;
            }
          }
        } catch (streamError) {
          if (eventsController.signal.aborted) return;
          setStatus('error');
          setError(humanMessage(streamError));
        }
      })();

      void (async () => {
        try {
          await createSeek({ ...params, signal: seekController.signal });
          // Se la richiesta termina da sola senza che sia arrivato un
          // gameStart, Lichess ha chiuso l'inserzione: la ricerca è scaduta.
          if (!seekController.signal.aborted) {
            setStatus((current) => (current === 'searching' ? 'idle' : current));
          }
        } catch (seekError) {
          if (seekController.signal.aborted) return;
          setStatus('error');
          setError(humanMessage(seekError));
        }
      })();
    },
    [teardown],
  );

  const cancel = useCallback(() => {
    teardown();
    setStatus('idle');
    setError(null);
    setElapsedSeconds(0);
  }, [teardown]);

  return { status, error, elapsedSeconds, start, cancel };
}
