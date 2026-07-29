import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Logo, Wordmark } from './Logo';
import { Sidebar } from './Sidebar';
import { RateLimitBanner } from './RateLimitBanner';
import { cn } from '@/lib/cn';
import { StorageKeys, storage } from '@/lib/storage';

export function Shell() {
  const [collapsed, setCollapsed] = useState(
    () => storage.get(StorageKeys.sidebarCollapsed) === '1',
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Cambiare rotta chiude il drawer: su mobile restare aperti dopo la
  // navigazione nasconderebbe la pagina appena raggiunta.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  // Il contenuto va riportato in cima a ogni cambio di sezione.
  useEffect(() => window.scrollTo(0, 0), [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      storage.set(StorageKeys.sidebarCollapsed, next ? '1' : '0');
      return next;
    });
  };

  return (
    <div className="min-h-dvh">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'transition-[padding] duration-250 ease-(--ease-out-quint)',
          collapsed ? 'md:pl-[68px]' : 'md:pl-[236px]',
        )}
      >
        {/* Barra superiore: esiste solo su mobile, per aprire il drawer */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-(--border-subtle) bg-(--page)/85 px-4 backdrop-blur-lg md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Apri menu"
            className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--surface-raised)"
          >
            <Menu className="size-5" />
          </button>
          <Logo className="size-7" />
          <Wordmark />
        </header>

        <RateLimitBanner />

        <main className="mx-auto w-full max-w-[1180px] px-4 py-6 md:px-8 md:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
