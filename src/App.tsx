import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { AuthError, RateLimitError } from '@/lib/lichess/errors';
import { useAuth } from '@/lib/auth/store';
import { ArchivePage } from '@/routes/ArchivePage';
import { FriendsPage } from '@/routes/FriendsPage';
import { GamePage } from '@/routes/GamePage';
import { HomePage } from '@/routes/HomePage';
import { PlayPage } from '@/routes/PlayPage';
import { PuzzlesPage } from '@/routes/PuzzlesPage';
import { ResourcesPage } from '@/routes/ResourcesPage';
import { ReviewPage } from '@/routes/ReviewPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // I dati Lichess non cambiano da un istante all'altro, e ogni refetch
      // consuma quota su un servizio gratuito: finestra ampia e nessun
      // refetch al focus della finestra.
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Un 401 non si risolve ritentando: serve un nuovo login.
        if (error instanceof AuthError) return false;
        // Il rate limit è già gestito dal limiter con attesa; un solo
        // tentativo aggiuntivo evita di accodare richieste all'infinito.
        if (error instanceof RateLimitError) return failureCount < 1;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

export function App() {
  const init = useAuth((state) => state.init);

  // Completa l'eventuale callback OAuth e recupera la sessione salvata prima
  // che le pagine inizino a chiedere dati.
  useEffect(() => void init(), [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/gioca" element={<PlayPage />} />
          <Route path="/partita/:gameId" element={<GamePage />} />
          <Route path="/riepilogo/:gameId" element={<ReviewPage />} />
          <Route path="/puzzle" element={<PuzzlesPage />} />
          <Route path="/amici" element={<FriendsPage />} />
          <Route path="/risorse" element={<ResourcesPage />} />
          <Route path="/archivio" element={<ArchivePage />} />
          {/* Qualsiasi rotta sconosciuta torna alla home invece di mostrare
              una pagina bianca. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  );
}
