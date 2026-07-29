import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth/store';
import { exportGames, fetchPuzzleActivity } from '../lichess/api';
import type { ExportedGame, PuzzleActivityEntry } from '../lichess/types';
import { buildActivityCalendar, countByDay } from '../stats/activity';
import { summarizeWinRate } from '../stats/games';

/** Settimane mostrate nelle heatmap della home. */
export const HEATMAP_WEEKS = 18;

/**
 * Giorni di storico da scaricare. Copre le settimane della heatmap più un
 * margine, così la colonna più a sinistra è completa.
 */
const HISTORY_DAYS = HEATMAP_WEEKS * 7 + 7;

/** Tetto sulle partite scaricate: protegge chi ne gioca centinaia al mese. */
const MAX_GAMES = 600;
const MAX_PUZZLES = 500;

function sinceTimestamp(days: number): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.getTime();
}

/**
 * Storico partite recenti.
 *
 * Una sola richiesta alimenta heatmap, streak, ultime partite e win rate: è
 * deliberato, perché `/api/games/user` è l'endpoint con il rate limit più
 * severo dell'API e moltiplicare le chiamate sarebbe sia lento sia scortese.
 */
export function useRecentGames() {
  const username = useAuth((state) => state.user?.username);
  const authenticated = useAuth((state) => state.status === 'authenticated');

  return useQuery({
    queryKey: ['games', 'recent', username],
    enabled: authenticated && Boolean(username),
    queryFn: ({ signal }) =>
      exportGames({
        username: username as string,
        since: sinceTimestamp(HISTORY_DAYS),
        max: MAX_GAMES,
        withMoves: false,
        withOpening: true,
        signal,
      }),
    // Lo storico partite cambia solo quando si gioca: vale la pena tenerlo
    // fresco più a lungo del default.
    staleTime: 3 * 60_000,
  });
}

export function usePuzzleActivity() {
  const authenticated = useAuth((state) => state.status === 'authenticated');
  const userId = useAuth((state) => state.user?.id);

  return useQuery({
    queryKey: ['puzzles', 'activity', userId],
    enabled: authenticated,
    queryFn: ({ signal }) => fetchPuzzleActivity(MAX_PUZZLES, signal),
    staleTime: 3 * 60_000,
  });
}

/** Aggregati derivati dallo storico partite, memoizzati. */
export function useGameStats(games: ExportedGame[] | undefined, userId: string | undefined) {
  return useMemo(() => {
    if (!games || !userId) return null;

    const calendar = buildActivityCalendar(
      countByDay(games.map((game) => game.createdAt)),
      { weeks: HEATMAP_WEEKS },
    );

    // Le partite arrivano già in ordine cronologico inverso dall'API, ma non ci
    // affidiamo a quell'ordine: ordinarle rende il codice indipendente da un
    // dettaglio dell'endpoint.
    const sorted = [...games].sort((a, b) => b.createdAt - a.createdAt);

    return {
      calendar,
      recent: sorted.slice(0, 5),
      winRate: summarizeWinRate(games, userId),
      totalGames: games.length,
    };
  }, [games, userId]);
}

export function usePuzzleStats(entries: PuzzleActivityEntry[] | undefined) {
  return useMemo(() => {
    if (!entries) return null;

    const calendar = buildActivityCalendar(
      countByDay(entries.map((entry) => entry.date)),
      { weeks: HEATMAP_WEEKS },
    );

    const solved = entries.filter((entry) => entry.win).length;

    return {
      calendar,
      total: entries.length,
      solved,
      accuracy: entries.length === 0 ? 0 : Math.round((solved / entries.length) * 100),
      /** Rating medio dei puzzle affrontati: indica il livello di allenamento. */
      averageRating:
        entries.length === 0
          ? 0
          : Math.round(
              entries.reduce((sum, entry) => sum + entry.puzzle.rating, 0) / entries.length,
            ),
    };
  }, [entries]);
}
