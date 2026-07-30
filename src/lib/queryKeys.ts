/**
 * Chiavi delle query React Query, in un punto solo.
 *
 * Non è pedanteria: chi invalida (la partita che finisce) e chi legge (home,
 * heatmap, archivio) stanno in file diversi, e una chiave scritta a mano due
 * volte è il modo più semplice per ritrovarsi con una cache che non si
 * aggiorna mai senza che nulla sembri rotto.
 */

export const gameQueryKeys = {
  /** Prefisso di tutte le query sulle partite: invalidando questo cadono sia
   *  lo storico della home sia le pagine dell'archivio. */
  all: ['games'] as const,
  recent: (username: string | undefined) => ['games', 'recent', username] as const,
  archive: (username: string | undefined) => ['games', 'archive', username] as const,
  /** Partite in corso: `/api/account/playing`. */
  playing: ['account', 'playing'] as const,
};

export const puzzleQueryKeys = {
  all: ['puzzles'] as const,
  activity: (userId: string | undefined) => ['puzzles', 'activity', userId] as const,
};
