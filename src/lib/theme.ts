import { create } from 'zustand';
import { StorageKeys, storage } from './storage';

export type ThemeChoice = 'light' | 'dark' | 'system';

interface ThemeState {
  choice: ThemeChoice;
  /** Tema effettivamente applicato dopo la risoluzione di `system`. */
  resolved: 'light' | 'dark';
  setChoice: (choice: ThemeChoice) => void;
}

const systemQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function resolve(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'system') return systemQuery?.matches ? 'dark' : 'light';
  return choice;
}

function apply(resolved: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  // Allinea la UI del browser (barra indirizzi mobile, scrollbar native).
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0d0b14' : '#fbfafd');
}

function readStoredChoice(): ThemeChoice {
  const stored = storage.get(StorageKeys.theme);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';
}

const initialChoice = readStoredChoice();
const initialResolved = resolve(initialChoice);
if (typeof document !== 'undefined') apply(initialResolved);

export const useTheme = create<ThemeState>((set) => ({
  choice: initialChoice,
  resolved: initialResolved,
  setChoice: (choice) => {
    storage.set(StorageKeys.theme, choice);
    const resolved = resolve(choice);
    apply(resolved);
    set({ choice, resolved });
  },
}));

/* Con la scelta su `system`, seguiamo i cambi di preferenza del sistema
   operativo in tempo reale invece di richiedere un ricaricamento. */
systemQuery?.addEventListener('change', () => {
  if (useTheme.getState().choice !== 'system') return;
  const resolved = resolve('system');
  apply(resolved);
  useTheme.setState({ resolved });
});
