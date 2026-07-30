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
  /** Una singola partita con mosse e analisi, per il riepilogo. */
  detail: (gameId: string | undefined) => ['games', 'detail', gameId] as const,
  /** Partite in corso: `/api/account/playing`. */
  playing: ['account', 'playing'] as const,
};

export const puzzleQueryKeys = {
  all: ['puzzles'] as const,
  activity: (userId: string | undefined) => ['puzzles', 'activity', userId] as const,
};

export const socialQueryKeys = {
  all: ['social'] as const,
  /** Elenco dei seguiti, per account. */
  following: (userId: string | undefined) => ['social', 'following', userId] as const,
  /** Presenza in tempo reale. La chiave include gli id perché cambiando la
   *  lista degli amici cambia anche la richiesta. */
  status: (ids: readonly string[]) => ['social', 'status', ids.join(',')] as const,
  profile: (username: string | undefined) => ['social', 'profile', username] as const,
  crosstable: (me: string | undefined, other: string | undefined) =>
    ['social', 'crosstable', me, other] as const,
};
