import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key } from 'chessground/types';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import type { Dests } from '@/lib/chess/rules';
import type { Color } from '@/lib/lichess/types';

export interface BoardProps {
  fen: string;
  orientation: Color;
  turnColor?: Color;
  lastMove?: [Key, Key] | undefined;
  check?: Color | undefined;
  /** Colore che l'utente può muovere. `undefined` = scacchiera in sola lettura. */
  movableColor?: Color | undefined;
  dests?: Dests;
  onMove?: (from: Key, to: Key) => void;
  /** Le premosse hanno senso solo in partite a tempo contro un avversario. */
  premovable?: boolean;
  onPremoveSet?: (from: Key, to: Key) => void;
  viewOnly?: boolean;
  coordinates?: boolean;
  animate?: boolean;
  /** Alone colorato attorno alla scacchiera, usato dal feedback dei puzzle. */
  feedback?: 'win' | 'fail' | undefined;
  /**
   * Contatore da incrementare per forzare una risincronizzazione.
   *
   * Serve perché Chessground applica la mossa dell'utente al proprio DOM
   * *prima* che noi la validiamo. Quando una mossa viene rifiutata (mossa
   * sbagliata in un puzzle, o mossa respinta dal server), `fen` non cambia: da
   * solo l'effetto di sincronizzazione non ripartirebbe e la scacchiera
   * resterebbe sulla posizione errata. Bumpando questo valore la posizione
   * corretta viene reimposta.
   */
  revision?: number;
  className?: string;
}

/**
 * Wrapper React su Chessground.
 *
 * Chessground è imperativo e gestisce il proprio DOM: viene quindi creato una
 * sola volta e successivamente aggiornato con `api.set()`. React non deve mai
 * ri-renderizzare i suoi figli, motivo per cui il div contenitore è vuoto.
 */
export function Board({
  fen,
  orientation,
  turnColor,
  lastMove,
  check,
  movableColor,
  dests,
  onMove,
  premovable = false,
  onPremoveSet,
  viewOnly = false,
  coordinates = true,
  animate = true,
  feedback,
  revision = 0,
  className,
}: BoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<Api | null>(null);

  // I callback vivono in un ref perché Chessground li registra una sola volta
  // alla creazione: senza questo, catturerebbe la prima closure per sempre.
  const onMoveRef = useRef(onMove);
  const onPremoveSetRef = useRef(onPremoveSet);
  onMoveRef.current = onMove;
  onPremoveSetRef.current = onPremoveSet;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const api = Chessground(element, {
      fen,
      orientation,
      coordinates,
      addDimensionsCssVarsTo: element,
      movable: {
        free: false,
        showDests: true,
        events: {
          after: (from, to) => onMoveRef.current?.(from, to),
        },
      },
      premovable: {
        enabled: premovable,
        showDests: true,
        events: {
          set: (from, to) => onPremoveSetRef.current?.(from, to),
        },
      },
      drawable: { enabled: true, visible: true },
      highlight: { lastMove: true, check: true },
      animation: { enabled: animate, duration: 200 },
      disableContextMenu: true,
    });

    apiRef.current = api;

    // In sviluppo l'API imperativa è raggiungibile dalla console per
    // ispezionare lo stato reale della scacchiera (turno, colore muovibile,
    // destinazioni). Non finisce nel bundle di produzione.
    if (import.meta.env.DEV) {
      (element as HTMLElement & { cgApi?: Api }).cgApi = api;
    }

    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // Creazione una sola volta: ogni cambiamento successivo passa da api.set().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizza lo stato dichiarativo verso l'API imperativa.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    const config: Config = {
      fen,
      orientation,
      viewOnly,
      // `check` accetta un colore oppure false per rimuovere l'evidenziazione.
      check: check ?? false,
      lastMove: lastMove ? [...lastMove] : undefined,
      movable: {
        free: false,
        color: viewOnly ? undefined : movableColor,
        dests: movableColor ? dests : new Map(),
        showDests: true,
      },
      premovable: { enabled: premovable && !viewOnly },
    };

    // `turnColor` va impostato solo se noto: passarlo undefined lo azzererebbe.
    if (turnColor) config.turnColor = turnColor;

    api.set(config);
  }, [
    fen,
    orientation,
    turnColor,
    lastMove,
    check,
    movableColor,
    dests,
    viewOnly,
    premovable,
    revision,
  ]);

  return (
    <div
      ref={containerRef}
      data-feedback={feedback}
      className={cn('arrocco-board', className)}
      // Le premosse restano valide solo se la scacchiera non viene ricreata:
      // nessuna `key` dinamica su questo elemento.
    />
  );
}
