/**
 * Derivazioni sulla lista amici.
 *
 * La lista arriva da due endpoint diversi con cadenze diverse: i profili da
 * `/api/rel/following` (lento, cambia di rado) e la presenza da
 * `/api/users/status` (veloce, ogni pochi secondi). Qui li uniamo in un'unica
 * struttura, così i componenti non devono inseguire due array in parallelo.
 */

import type { Perf, PublicUser, UserStatus } from '../lichess/types';

export type Presence = 'playing' | 'streaming' | 'online' | 'offline';

export interface Friend {
  user: PublicUser;
  /** Assente finché la prima risposta di `/api/users/status` non è arrivata. */
  status?: UserStatus;
  presence: Presence;
}

/**
 * Perf con un rating vero e proprio.
 *
 * L'oggetto `perfs` mescola due forme diverse: le cadenze e le varianti hanno
 * `{games, rating, rd, prog}`, mentre `storm`, `racer` e `streak` hanno
 * `{runs, score}`. Leggere `rating` su queste ultime darebbe `undefined`, e
 * ordinarle per numero di partite le farebbe finire in cima con `NaN`: per
 * questo l'elenco è esplicito invece di essere dedotto.
 */
const RATED_PERFS: readonly string[] = [
  'ultraBullet',
  'bullet',
  'blitz',
  'rapid',
  'classical',
  'correspondence',
  'chess960',
  'crazyhouse',
  'antichess',
  'atomic',
  'horde',
  'kingOfTheHill',
  'racingKings',
  'threeCheck',
];

export interface NamedPerf {
  key: string;
  perf: Perf;
}

/**
 * La cadenza più rappresentativa del giocatore: quella con più partite.
 *
 * I rating provvisori vengono scartati se esiste un'alternativa consolidata,
 * perché un 1500±350 dopo tre partite dice meno di un rating stabile su una
 * cadenza meno giocata.
 */
export function mainPerf(user: PublicUser): NamedPerf | null {
  const entries: NamedPerf[] = [];

  for (const key of RATED_PERFS) {
    const perf = user.perfs?.[key];
    if (!perf || perf.games === 0) continue;
    entries.push({ key, perf });
  }

  if (entries.length === 0) return null;

  const established = entries.filter((entry) => !entry.perf.prov);
  const pool = established.length > 0 ? established : entries;

  return pool.reduce((best, entry) => (entry.perf.games > best.perf.games ? entry : best));
}

/** Tutte le cadenze giocate, dalla più praticata: per la scheda profilo. */
export function ratedPerfs(user: PublicUser): NamedPerf[] {
  return RATED_PERFS.flatMap((key) => {
    const perf = user.perfs?.[key];
    return perf && perf.games > 0 ? [{ key, perf }] : [];
  }).sort((a, b) => b.perf.games - a.perf.games);
}

function presenceOf(status: UserStatus | undefined): Presence {
  if (!status) return 'offline';
  if (status.playing) return 'playing';
  if (status.streaming) return 'streaming';
  // I flag falsi non vengono inviati: l'assenza di `online` significa offline.
  return status.online ? 'online' : 'offline';
}

/** Ordine di visualizzazione: prima chi è raggiungibile adesso. */
const PRESENCE_RANK: Record<Presence, number> = {
  playing: 0,
  streaming: 1,
  online: 2,
  offline: 3,
};

/**
 * Unisce profili e presenza, e ordina.
 *
 * A parità di presenza vince chi si è visto più di recente; `seenAt` può
 * mancare, e in quel caso il giocatore finisce in fondo al proprio gruppo
 * invece di scavalcare tutti con uno zero.
 */
export function mergeFriends(
  following: readonly PublicUser[],
  statuses: readonly UserStatus[],
): Friend[] {
  const byId = new Map(statuses.map((status) => [status.id, status]));

  const friends = following.map((user) => {
    const status = byId.get(user.id);
    return { user, status, presence: presenceOf(status) };
  });

  return friends.sort((a, b) => {
    const rank = PRESENCE_RANK[a.presence] - PRESENCE_RANK[b.presence];
    if (rank !== 0) return rank;
    const seen = (b.user.seenAt ?? 0) - (a.user.seenAt ?? 0);
    if (seen !== 0) return seen;
    return a.user.username.localeCompare(b.user.username);
  });
}

export interface PresenceCounts {
  total: number;
  online: number;
  playing: number;
}

export function countPresence(friends: readonly Friend[]): PresenceCounts {
  let online = 0;
  let playing = 0;

  for (const friend of friends) {
    if (friend.presence === 'offline') continue;
    // Chi sta giocando è anche online: conta in entrambi i totali.
    online += 1;
    if (friend.presence === 'playing') playing += 1;
  }

  return { total: friends.length, online, playing };
}

/** Filtro testuale sul nome utente e sul nome reale. */
export function filterFriends(friends: readonly Friend[], query: string): Friend[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...friends];

  return friends.filter((friend) => {
    if (friend.user.username.toLowerCase().includes(needle)) return true;
    const realName = friend.user.profile?.realName?.toLowerCase();
    return Boolean(realName?.includes(needle));
  });
}

/**
 * Punteggio del testa a testa dal nostro punto di vista.
 *
 * Il crosstable indicizza i punteggi per id utente e usa la convenzione
 * scacchistica (patta = ½), quindi i valori possono essere frazionari.
 */
export function crosstableScore(
  users: Record<string, number>,
  meId: string,
  otherId: string,
): { mine: number; theirs: number } {
  return { mine: users[meId] ?? 0, theirs: users[otherId] ?? 0 };
}
