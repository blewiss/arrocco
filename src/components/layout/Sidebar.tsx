import { ChevronsLeft, LogIn, LogOut, Monitor, Moon, Sun, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Logo, Wordmark } from './Logo';
import { NAV_ITEMS } from './navigation';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth/store';
import { useTheme, type ThemeChoice } from '@/lib/theme';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Su mobile la sidebar è un drawer sovrapposto. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {/* Backdrop del drawer mobile */}
      <div
        onClick={onCloseMobile}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-200 md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col',
          'border-r border-(--border-subtle) bg-(--surface)',
          'transition-[width,transform] duration-250 ease-(--ease-out-quint)',
          collapsed ? 'md:w-[68px]' : 'md:w-[236px]',
          // Fuori schermo su mobile finché non viene aperta.
          'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Logo />
          {!collapsed && <Wordmark className="md:inline" />}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Chiudi menu"
            className="ml-auto rounded-lg p-1.5 text-muted hover:bg-(--surface-raised) md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              // `end` solo sulla root, altrimenti "/" resterebbe attiva sempre.
              end={item.to === '/'}
              onClick={onCloseMobile}
              title={collapsed ? `${item.label} — ${item.hint}` : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-[10px] px-2.5 py-2',
                  'text-[13.5px] font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-brand-500/12 text-brand-400'
                    : 'text-(--text-secondary) hover:bg-(--surface-raised) hover:text-(--text-primary)',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Indicatore verticale sulla voce attiva */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500',
                      'transition-opacity duration-150',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <item.icon className="size-[18px] shrink-0" strokeWidth={2} />
                  <span className={cn('truncate', collapsed && 'md:hidden')}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 border-t border-(--border-subtle) p-2.5">
          <ThemeSwitch collapsed={collapsed} />
          <AccountBlock collapsed={collapsed} />
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Espandi menu' : 'Comprimi menu'}
            className={cn(
              'hidden w-full items-center gap-3 rounded-[10px] px-2.5 py-2 md:flex',
              'text-[13px] text-muted transition-colors hover:bg-(--surface-raised) hover:text-(--text-primary)',
            )}
          >
            <ChevronsLeft
              className={cn(
                'size-[18px] shrink-0 transition-transform duration-250',
                collapsed && 'rotate-180',
              )}
            />
            <span className={cn(collapsed && 'md:hidden')}>Comprimi</span>
          </button>
        </div>
      </aside>
    </>
  );
}

const THEME_OPTIONS: Array<{ value: ThemeChoice; icon: typeof Sun; label: string }> = [
  { value: 'light', icon: Sun, label: 'Chiaro' },
  { value: 'dark', icon: Moon, label: 'Scuro' },
  { value: 'system', icon: Monitor, label: 'Sistema' },
];

function ThemeSwitch({ collapsed }: { collapsed: boolean }) {
  const choice = useTheme((state) => state.choice);
  const resolved = useTheme((state) => state.resolved);
  const setChoice = useTheme((state) => state.setChoice);

  // Compressa, la sidebar non ha spazio per tre pulsanti: mostra solo il
  // toggle fra chiaro e scuro.
  if (collapsed) {
    const isDark = resolved === 'dark';
    return (
      <button
        type="button"
        onClick={() => setChoice(isDark ? 'light' : 'dark')}
        aria-label={isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
        className="hidden w-full justify-center rounded-[10px] p-2 text-muted hover:bg-(--surface-raised) hover:text-(--text-primary) md:flex"
      >
        {isDark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="flex gap-0.5 rounded-[10px] bg-(--surface-sunken) p-0.5"
    >
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={choice === option.value}
          title={option.label}
          onClick={() => setChoice(option.value)}
          className={cn(
            'flex flex-1 items-center justify-center rounded-lg py-1.5 transition-colors',
            choice === option.value
              ? 'bg-(--surface-raised) text-brand-400 shadow-sm'
              : 'text-muted hover:text-(--text-primary)',
          )}
        >
          <option.icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

function AccountBlock({ collapsed }: { collapsed: boolean }) {
  const status = useAuth((state) => state.status);
  const user = useAuth((state) => state.user);
  const login = useAuth((state) => state.login);
  const logout = useAuth((state) => state.logout);

  if (status !== 'authenticated' || !user) {
    return (
      <button
        type="button"
        onClick={() => void login()}
        title="Accedi con Lichess"
        className={cn(
          'flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2',
          'text-[13px] font-medium text-brand-400 transition-colors hover:bg-brand-500/10',
          collapsed && 'md:justify-center md:px-0',
        )}
      >
        <LogIn className="size-[18px] shrink-0" />
        <span className={cn(collapsed && 'md:hidden')}>Accedi</span>
      </button>
    );
  }

  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-[10px] px-2 py-1.5',
        collapsed && 'md:justify-center md:px-0',
      )}
    >
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[12px] font-bold text-brand-400"
        aria-hidden="true"
      >
        {initial}
      </div>
      <div className={cn('min-w-0 flex-1', collapsed && 'md:hidden')}>
        <p className="truncate text-[13px] font-medium text-(--text-primary)">{user.username}</p>
        <p className="text-[11px] text-muted">Connesso a Lichess</p>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        title="Esci"
        aria-label="Esci"
        className={cn(
          'rounded-lg p-1.5 text-muted transition-colors hover:bg-(--surface-raised) hover:text-(--color-loss)',
          collapsed && 'md:hidden',
        )}
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
