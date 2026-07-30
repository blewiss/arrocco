import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth/store';
import {
  fetchCrosstable,
  fetchFollowing,
  fetchPublicUser,
  fetchUsersStatus,
} from '../lichess/api';
import { socialQueryKeys } from '../queryKeys';
import { mergeFriends, type Friend } from '../social/friends';

/**
 * Ogni quanto rinfrescare la presenza.
 *
 * La spec di `/api/users/status` autorizza esplicitamente una chiamata ogni
 * 5 secondi ("very fast and cheap on lichess side"). Stiamo un po' più larghi:
 * per una lista amici la differenza non si nota, e lascia margine a chi ne
 * segue più di cento, dove ogni giro sono più richieste.
 *
 * React Query non fa scattare l'intervallo quando la finestra non è a fuoco
 * (`refetchIntervalInBackground` è false di default), quindi una scheda
 * dimenticata aperta non continua a chiamare Lichess.
 */
const PRESENCE_INTERVAL_MS = 8_000;

/** Elenco dei giocatori seguiti. Cambia di rado: cache lunga. */
export function useFollowing() {
  const authenticated = useAuth((state) => state.status === 'authenticated');
  const userId = useAuth((state) => state.user?.id);

  return useQuery({
    queryKey: socialQueryKeys.following(userId),
    enabled: authenticated,
    queryFn: ({ signal }) => fetchFollowing(signal),
    staleTime: 10 * 60_000,
  });
}

/** Presenza in tempo reale degli id indicati. */
export function useFriendsStatus(ids: readonly string[]) {
  return useQuery({
    queryKey: socialQueryKeys.status(ids),
    enabled: ids.length > 0,
    queryFn: ({ signal }) => fetchUsersStatus(ids, signal),
    refetchInterval: PRESENCE_INTERVAL_MS,
    refetchOnWindowFocus: true,
    // Il dato è vivo per definizione: non ha senso considerarlo fresco.
    staleTime: 0,
    // Cambiando la lista degli amici cambia la chiave: senza questo la
    // presenza sparirebbe per un istante e le righe "salterebbero".
    placeholderData: keepPreviousData,
  });
}

export interface FriendsResult {
  friends: Friend[];
  loading: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Lista amici completa: profili più presenza, già unite e ordinate.
 *
 * Le due query restano separate apposta — la presenza si aggiorna ogni pochi
 * secondi, i profili quasi mai — ma il componente ne vede una sola.
 */
export function useFriends(): FriendsResult {
  const following = useFollowing();

  const ids = useMemo(
    () => (following.data ?? []).map((user) => user.id),
    [following.data],
  );

  const statuses = useFriendsStatus(ids);

  const friends = useMemo(
    () => mergeFriends(following.data ?? [], statuses.data ?? []),
    [following.data, statuses.data],
  );

  return {
    friends,
    // Il caricamento è quello dei profili: senza di loro non c'è nulla da
    // mostrare, mentre la presenza arriva subito dopo e si aggiunge da sé.
    loading: following.isPending && following.fetchStatus !== 'idle',
    error: following.error,
    refetch: () => void following.refetch(),
  };
}

/** Profilo pubblico di un giocatore, per la scheda di dettaglio. */
export function useFriendProfile(username: string | undefined) {
  return useQuery({
    queryKey: socialQueryKeys.profile(username),
    enabled: Boolean(username),
    queryFn: ({ signal }) => fetchPublicUser(username as string, signal),
    staleTime: 5 * 60_000,
  });
}

/** Testa a testa fra l'utente collegato e un altro giocatore. */
export function useCrosstable(otherUsername: string | undefined) {
  const me = useAuth((state) => state.user?.username);

  return useQuery({
    queryKey: socialQueryKeys.crosstable(me, otherUsername),
    // Il crosstable con sé stessi non ha senso e Lichess risponde comunque.
    enabled: Boolean(me && otherUsername && me !== otherUsername),
    queryFn: ({ signal }) => fetchCrosstable(me as string, otherUsername as string, signal),
    staleTime: 5 * 60_000,
  });
}
