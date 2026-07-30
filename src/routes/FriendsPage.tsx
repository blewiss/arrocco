import { LogIn, Search, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FriendList, FriendListSkeleton } from '@/components/social/FriendList';
import { FriendProfileCard } from '@/components/social/FriendProfileCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/lib/auth/store';
import { cn } from '@/lib/cn';
import { LICHESS_ORIGIN } from '@/lib/lichess/config';
import { humanMessage } from '@/lib/lichess/errors';
import { useFriends } from '@/lib/hooks/useFriends';
import { countPresence, filterFriends } from '@/lib/social/friends';

type PresenceFilter = 'all' | 'online';

export function FriendsPage() {
  const status = useAuth((state) => state.status);
  const login = useAuth((state) => state.login);

  const { friends, loading, error, refetch } = useFriends();

  const [search, setSearch] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => countPresence(friends), [friends]);

  const visible = useMemo(() => {
    const bySearch = filterFriends(friends, search);
    if (presenceFilter === 'all') return bySearch;
    return bySearch.filter((friend) => friend.presence !== 'offline');
  }, [friends, presenceFilter, search]);

  // La selezione sopravvive ai filtri: la scheda resta aperta anche se la riga
  // corrispondente esce dall'elenco perché l'amico è andato offline.
  const selected = useMemo(
    () => friends.find((friend) => friend.user.id === selectedId) ?? null,
    [friends, selectedId],
  );

  if (status !== 'authenticated') {
    return (
      <div className="animate-in">
        <Header />
        <Card className="mt-6">
          <EmptyState
            icon={<LogIn className="size-5" />}
            title="Accedi per vedere i tuoi amici"
            description="L’elenco dei giocatori che segui viene letto dal tuo account Lichess."
            action={<Button onClick={() => void login()}>Accedi con Lichess</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-in space-y-5">
      <Header />

      <Card className="grid grid-cols-3 gap-4">
        <StatTile label="Seguiti" value={counts.total} />
        <StatTile label="Online ora" value={counts.online} tone="win" />
        <StatTile label="In partita" value={counts.playing} tone="brand" />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-(--border-subtle) px-4 py-3">
            <label className="relative min-w-0 flex-1">
              <Search
                className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cerca fra i tuoi amici"
                aria-label="Cerca fra i tuoi amici"
                className={cn(
                  'h-8 w-full rounded-lg bg-(--surface-sunken) pr-3 pl-8',
                  'text-[13px] placeholder:text-muted focus:outline-none',
                  'focus-visible:outline-2 focus-visible:outline-brand-500',
                )}
              />
            </label>

            <div className="flex gap-0.5 rounded-lg bg-(--surface-sunken) p-0.5">
              {(
                [
                  { value: 'all', label: 'Tutti' },
                  { value: 'online', label: 'Online' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPresenceFilter(option.value)}
                  aria-pressed={presenceFilter === option.value}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                    presenceFilter === option.value
                      ? 'bg-(--surface-raised) text-brand-400 shadow-sm'
                      : 'text-muted hover:text-(--text-primary)',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <ErrorState className="m-4" message={humanMessage(error)} onRetry={refetch} />
          ) : loading ? (
            <FriendListSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="size-5" />}
              title={emptyTitle(friends.length, search, presenceFilter)}
              description={emptyDescription(friends.length, search, presenceFilter)}
              action={
                friends.length === 0 ? (
                  <a
                    href={`${LICHESS_ORIGIN}/player`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[13px] font-medium text-brand-400 hover:text-brand-300"
                  >
                    Trova giocatori su Lichess →
                  </a>
                ) : undefined
              }
            />
          ) : (
            <FriendList
              friends={visible}
              selectedId={selected?.user.id}
              onSelect={(friend) => setSelectedId(friend.user.id)}
            />
          )}
        </Card>

        {/* Su schermo largo la scheda resta a fianco e segue lo scorrimento;
            su mobile scavalca l'elenco, così chi tocca una riga la vede
            comparire dov'era invece che in fondo alla pagina. */}
        <div className="order-first lg:sticky lg:top-5 lg:order-none">
          {selected ? (
            <FriendProfileCard
              key={selected.user.id}
              friend={selected}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <Card className="hidden lg:block">
              <EmptyState
                compact
                icon={<Users className="size-5" />}
                title="Nessun amico selezionato"
                description="Scegli un giocatore dall’elenco per vedere rating, statistiche e il vostro testa a testa."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header>
      <h1 className="text-[24px] leading-tight font-semibold tracking-tight md:text-[28px]">
        Amici
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        I giocatori che segui su Lichess, con chi è online adesso. Seguire o smettere di seguire
        resta un’azione da fare su Lichess.
      </p>
    </header>
  );
}

function emptyTitle(total: number, search: string, filter: PresenceFilter): string {
  if (total === 0) return 'Non segui ancora nessuno';
  if (search.trim()) return 'Nessun risultato';
  return filter === 'online' ? 'Nessun amico online' : 'Nessun amico da mostrare';
}

function emptyDescription(total: number, search: string, filter: PresenceFilter): string {
  if (total === 0) {
    return 'Su Lichess puoi seguire i giocatori che incontri: appariranno qui, con il loro stato in tempo reale.';
  }
  if (search.trim()) return 'Nessuno dei tuoi amici corrisponde alla ricerca.';
  return filter === 'online'
    ? 'In questo momento nessuno dei giocatori che segui è collegato.'
    : 'Prova a cambiare i filtri.';
}
