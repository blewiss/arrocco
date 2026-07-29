import { create } from 'zustand';
import { fetchAccount } from '../lichess/api';
import { setTokenProvider, setUnauthorizedHandler } from '../lichess/client';
import { humanMessage } from '../lichess/errors';
import type { AccountUser } from '../lichess/types';
import { isTauri } from '../platform';
import { StorageKeys, readJson, storage, writeJson } from '../storage';
import {
  beginLogin,
  completeLoginFromDeepLink,
  completeLoginFromUrl,
  revokeToken,
  type CallbackResult,
  type StoredToken,
} from './pkce';

export type AuthStatus =
  /** Prima del completamento di `init`: non sappiamo ancora chi è l'utente. */
  | 'unknown'
  /** In corso: scambio del codice OAuth o recupero dell'account. */
  | 'loading'
  | 'anonymous'
  | 'authenticated';

interface AuthState {
  status: AuthStatus;
  token: string | null;
  user: AccountUser | null;
  error: string | null;
  init: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  dismissError: () => void;
}

function loadStoredToken(): StoredToken | null {
  const stored = readJson<StoredToken>(StorageKeys.token);
  if (!stored?.accessToken) return null;
  // Un token scaduto viene scartato subito, senza tentare chiamate destinate
  // a ricevere 401.
  if (stored.expiresAt !== null && stored.expiresAt <= Date.now()) {
    storage.remove(StorageKeys.token);
    return null;
  }
  return stored;
}

/** Evita che `init` giri due volte (React StrictMode monta i componenti due volte). */
let initPromise: Promise<void> | null = null;

export const useAuth = create<AuthState>((set, get) => ({
  status: 'unknown',
  token: null,
  user: null,
  error: null,

  init: () => {
    initPromise ??= (async () => {
      set({ status: 'loading' });

      // Su desktop il codice OAuth arriva via deep link, in un momento
      // qualunque: il listener va registrato una volta sola, all'avvio.
      if (isTauri()) void registerDeepLinkListener();

      const callback = await completeLoginFromUrl();

      if (callback.status === 'success' && callback.token) {
        writeJson(StorageKeys.token, callback.token);
      } else if (callback.status === 'denied' || callback.status === 'error') {
        set({ status: 'anonymous', error: callback.message ?? null });
        return;
      }

      const stored = loadStoredToken();
      if (!stored) {
        set({ status: 'anonymous', token: null, user: null });
        return;
      }

      set({ token: stored.accessToken });

      try {
        const user = await fetchAccount();
        set({ status: 'authenticated', user, error: null });
      } catch (error) {
        // Il token c'era ma non è utilizzabile: ripuliamo e torniamo anonimi.
        storage.remove(StorageKeys.token);
        set({
          status: 'anonymous',
          token: null,
          user: null,
          error: humanMessage(error),
        });
      }
    })();

    return initPromise;
  },

  login: async () => {
    set({ error: null });
    try {
      await beginLogin();
    } catch (error) {
      set({ error: humanMessage(error) });
    }
  },

  logout: async () => {
    const { token } = get();
    // Lo stato locale viene azzerato subito: il logout deve essere immediato
    // dal punto di vista dell'utente, la revoca remota è un'operazione di
    // pulizia che avviene in background.
    storage.remove(StorageKeys.token);
    set({ status: 'anonymous', token: null, user: null, error: null });
    initPromise = null;
    if (token) await revokeToken(token);
  },

  dismissError: () => set({ error: null }),
}));

/** Applica il risultato di un callback OAuth, da qualunque fonte provenga. */
async function applyCallback(callback: CallbackResult): Promise<void> {
  if (callback.status === 'none') return;

  if (callback.status !== 'success' || !callback.token) {
    useAuth.setState({ status: 'anonymous', error: callback.message ?? null });
    return;
  }

  writeJson(StorageKeys.token, callback.token);
  useAuth.setState({ status: 'loading', token: callback.token.accessToken, error: null });

  try {
    const user = await fetchAccount();
    useAuth.setState({ status: 'authenticated', user, error: null });
  } catch (error) {
    storage.remove(StorageKeys.token);
    useAuth.setState({
      status: 'anonymous',
      token: null,
      user: null,
      error: humanMessage(error),
    });
  }
}

let deepLinkRegistered = false;

/**
 * Registra il listener dei deep link su desktop.
 *
 * `onOpenUrl` copre il caso in cui l'app è già in esecuzione;
 * `getCurrent` copre l'avvio a freddo, quando il link ha lanciato l'app e
 * l'evento è già stato consegnato prima che il listener esistesse.
 */
async function registerDeepLinkListener(): Promise<void> {
  if (deepLinkRegistered) return;
  deepLinkRegistered = true;

  try {
    const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link');

    await onOpenUrl((urls) => {
      for (const url of urls) {
        void completeLoginFromDeepLink(url).then(applyCallback);
      }
    });

    const initial = await getCurrent();
    for (const url of initial ?? []) {
      void completeLoginFromDeepLink(url).then(applyCallback);
    }
  } catch {
    // Senza il plugin (o fuori da Tauri) il login desktop non è disponibile,
    // ma l'app resta perfettamente utilizzabile sul web.
    deepLinkRegistered = false;
  }
}

/* Il client HTTP legge il token dallo store senza importarlo direttamente,
   il che evita un ciclo di dipendenze fra i due moduli. */
setTokenProvider(() => useAuth.getState().token);

/* Se Lichess rifiuta il token durante una qualsiasi chiamata, la sessione è
   finita: azzeriamo tutto invece di lasciare la UI in uno stato incoerente. */
setUnauthorizedHandler(() => {
  if (useAuth.getState().status === 'anonymous') return;
  storage.remove(StorageKeys.token);
  initPromise = null;
  useAuth.setState({
    status: 'anonymous',
    token: null,
    user: null,
    error: 'La sessione Lichess è scaduta. Accedi di nuovo per continuare.',
  });
});
