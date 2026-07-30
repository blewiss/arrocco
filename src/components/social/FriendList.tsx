import { Radio, Swords } from 'lucide-react';
import { formatRelative } from '@/components/home/RecentGames';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { LICHESS_ORIGIN } from '@/lib/lichess/config';
import { mainPerf, type Friend, type Presence } from '@/lib/social/friends';
import { speedLabel } from '@/lib/stats/games';

const PRESENCE_STYLE: Record<Presence, { dot: string; label: string }> = {
  playing: { dot: 'bg-brand-500 ring-3 ring-brand-500/20', label: 'In partita' },
  streaming: {
    dot: 'bg-(--color-loss) ring-3 ring-(--color-loss)/20',
    label: 'In diretta',
  },
  online: { dot: 'bg-(--color-win) ring-3 ring-(--color-win)/20', label: 'Online' },
  // Nessun alone su chi è offline: l'assenza di enfasi è essa stessa
  // l'informazione, e tiene la lista silenziosa dove non succede niente.
  offline: { dot: 'bg-(--border-strong)', label: 'Offline' },
};

export function PresenceDot({ presence }: { presence: Presence }) {
  const style = PRESENCE_STYLE[presence];
  return (
    <span
      title={style.label}
      aria-label={style.label}
      className={cn('inline-block size-2.5 shrink-0 rounded-full', style.dot)}
    />
  );
}

interface FriendListProps {
  friends: Friend[];
  selectedId?: string;
  onSelect: (friend: Friend) => void;
}

export function FriendList({ friends, selectedId, onSelect }: FriendListProps) {
  return (
    <ul className="divide-y divide-(--border-subtle)">
      {friends.map((friend) => (
        <FriendRow
          key={friend.user.id}
          friend={friend}
          selected={friend.user.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function FriendRow({
  friend,
  selected,
  onSelect,
}: {
  friend: Friend;
  selected: boolean;
  onSelect: (friend: Friend) => void;
}) {
  const { user, status, presence } = friend;
  const perf = mainPerf(user);
  const game = status?.playing;

  return (
    <li
      className={cn(
        'group flex items-center transition-colors',
        selected ? 'bg-brand-500/8' : 'hover:bg-(--surface-raised)',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(friend)}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-5 text-left"
      >
        <PresenceDot presence={presence} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {user.title && (
              <Badge tone={user.title === 'BOT' ? 'neutral' : 'brand'}>{user.title}</Badge>
            )}
            <span className="truncate text-[13.5px] font-medium">{user.username}</span>
            {user.patron && (
              <span title="Patron di Lichess" className="text-[12px] text-brand-400">
                ♥
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {perf ? (
              <>
                <span className="tnum">{perf.perf.rating}</span>
                {perf.perf.prov && '?'} in {speedLabel(perf.key)}
              </>
            ) : (
              'Nessuna partita valutata'
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pr-2">
          {presence === 'streaming' && (
            <Radio className="size-3.5 text-(--color-loss)" aria-hidden="true" />
          )}
          <span className="tnum w-14 text-right text-[12px] text-muted">
            {presence === 'playing'
              ? (game?.clock ?? 'gioca')
              : presence === 'offline'
                ? user.seenAt
                  ? formatRelative(user.seenAt)
                  : '—'
                : PRESENCE_STYLE[presence].label}
          </span>
        </div>
      </button>

      {/* La partita in corso di un altro giocatore si guarda su Lichess: la
          pagina Partita di Arrocco parla con la Board API, che serve solo le
          partite in cui siamo noi a giocare. */}
      {game && (
        <a
          href={`${LICHESS_ORIGIN}/${game.id}`}
          target="_blank"
          rel="noreferrer noopener"
          title="Guarda la partita su Lichess"
          aria-label={`Guarda la partita di ${user.username} su Lichess`}
          className="mr-3 ml-1 shrink-0 rounded-md p-1.5 text-muted transition-colors hover:text-brand-400"
        >
          <Swords className="size-3.5" />
        </a>
      )}
    </li>
  );
}

/** Righe fantasma mentre l'elenco dei seguiti è in arrivo. */
export function FriendListSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-2.5">
          <Skeleton className="size-2.5 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5" style={{ maxWidth: '140px' }} />
            <Skeleton className="h-3" style={{ maxWidth: '90px' }} />
          </div>
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
