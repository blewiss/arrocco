/**
 * Piccolo strato di astrazione sulla persistenza.
 *
 * In web usa localStorage. È isolato in un modulo unico perché la versione
 * desktop potrà passare a un backend nativo (es. il plugin store di Tauri, o
 * il keyring di sistema per il token OAuth) sostituendo solo questo file.
 */

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const memoryFallback = new Map<string, string>();

/** localStorage può lanciare in modalità privata o con i cookie bloccati. */
function localStorageAvailable(): boolean {
  try {
    const probe = '__arrocco_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const useLocalStorage = typeof window !== 'undefined' && localStorageAvailable();

export const storage: KeyValueStore = {
  get(key) {
    if (!useLocalStorage) return memoryFallback.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    if (!useLocalStorage) {
      memoryFallback.set(key, value);
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryFallback.set(key, value);
    }
  },
  remove(key) {
    memoryFallback.delete(key);
    if (!useLocalStorage) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* niente da fare */
    }
  },
};

/** Legge e deserializza JSON, restituendo null se assente o corrotto. */
export function readJson<T>(key: string): T | null {
  const raw = storage.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    storage.remove(key);
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

export const StorageKeys = {
  token: 'arrocco.token',
  pkceVerifier: 'arrocco.pkce.verifier',
  pkceState: 'arrocco.pkce.state',
  theme: 'arrocco.theme',
  sidebarCollapsed: 'arrocco.sidebar.collapsed',
  playPrefs: 'arrocco.play.prefs',
  boardOrientation: 'arrocco.board.orientation',
} as const;
