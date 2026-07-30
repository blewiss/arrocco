import { ExternalLink, X } from 'lucide-react';
import { formatRelative } from '@/components/home/RecentGames';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/lib/auth/store';
import { useCrosstable, useFriendProfile } from '@/lib/hooks/useFriends';
import { cn } from '@/lib/cn';
import { LICHESS_ORIGIN } from '@/lib/lichess/config';
import { humanMessage } from '@/lib/lichess/errors';
import { crosstableScore, ratedPerfs, type Friend } from '@/lib/social/friends';
import { speedLabel } from '@/lib/stats/games';
import { PresenceDot } from './FriendList';

/** Cadenze mostrate nella griglia: le altre restano su Lichess. */
const MAX_PERFS = 6;

export function FriendProfileCard({
  friend,
  onClose,
}: {
  friend: Friend;
  onClose: () => void;
}) {
  const meId = useAuth((state) => state.user?.id);
  const profileQuery = useFriendProfile(friend.user.username);
  const crosstableQuery = useCrosstable(friend.user.username);

  // Il profilo dell'elenco è già completo: lo mostriamo subito e lo lasciamo
  // rimpiazzare dalla versione con `rank` e `count.me` quando arriva, invece
  // di far lampeggiare uno scheletro su dati che abbiamo già.
  const user = profileQuery.data ?? friend.user;
  const perfs = ratedPerfs(user).slice(0, MAX_PERFS);
  const count = user.count;

  return (
    <Card className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {user.title && (
              <Badge tone={user.title === 'BOT' ? 'neutral' : 'brand'}>{user.title}</Badge>
            )}
            <h2 className="truncate text-[17px] font-semibold">{user.username}</h2>
            {user.patron && (
              <span title="Patron di Lichess" className="text-brand-400">
                ♥
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted">
            <PresenceDot presence={friend.presence} />
            <PresenceText friend={friend} />
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <a
            href={user.url ?? `${LICHESS_ORIGIN}/@/${user.username}`}
            target="_blank"
            rel="noreferrer noopener"
            title="Apri il profilo su Lichess"
            aria-label="Apri il profilo su Lichess"
            className="rounded-md p-1.5 text-muted transition-colors hover:text-brand-400"
          >
            <ExternalLink className="size-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            title="Chiudi la scheda"
            aria-label="Chiudi la scheda"
            className="rounded-md p-1.5 text-muted transition-colors hover:text-(--text-primary)"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {user.disabled ? (
        <p className="text-[13px] text-muted">Questo account è stato chiuso.</p>
      ) : (
        <>
          {(user.profile?.realName || user.profile?.bio) && (
            <div className="space-y-1">
              {user.profile.realName && (
                <p className="text-[13px] font-medium">{user.profile.realName}</p>
              )}
              {user.profile.bio && (
                <p className="selectable text-[12.5px] leading-relaxed text-muted">
                  {user.profile.bio}
                </p>
              )}
            </div>
          )}

          <Crosstable
            query={crosstableQuery}
            meId={meId}
            otherId={user.id}
            otherName={user.username}
          />

          {perfs.length > 0 && (
            <div>
              <SectionLabel>Rating</SectionLabel>
              <div className="mt-2.5 grid grid-cols-3 gap-x-3 gap-y-3.5">
                {perfs.map(({ key, perf }) => (
                  <div key={key}>
                    <p className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">
                      {speedLabel(key)}
                    </p>
                    <p
                      className={cn(
                        'tnum mt-0.5 text-[18px] leading-none font-semibold',
                        // Un rating provvisorio non è un dato allo stesso
                        // titolo degli altri: resta leggibile ma non compete.
                        perf.prov && 'text-muted',
                      )}
                    >
                      {perf.rating}
                      {perf.prov && '?'}
                    </p>
                    <p className="tnum mt-1 truncate text-[11.5px] text-muted">
                      {perf.games.toLocaleString('it-IT')} partite
                      {perf.rank !== undefined && ` · #${perf.rank.toLocaleString('it-IT')}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {count && (
            <div>
              <SectionLabel>Bilancio complessivo</SectionLabel>
              <div className="mt-2.5 grid grid-cols-4 gap-3">
                <StatTile label="Partite" value={count.all.toLocaleString('it-IT')} />
                <StatTile label="Vinte" value={count.win.toLocaleString('it-IT')} tone="win" />
                <StatTile label="Perse" value={count.loss.toLocaleString('it-IT')} tone="loss" />
                <StatTile label="Patte" value={count.draw.toLocaleString('it-IT')} />
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-y-2 border-t border-(--border-subtle) pt-4 text-[12.5px]">
            <Meta label="Su Lichess dal" value={formatJoined(user.createdAt)} />
            <Meta
              label="Ultimo accesso"
              value={user.seenAt ? formatRelative(user.seenAt) : '—'}
            />
            <Meta label="Tempo di gioco" value={formatPlayTime(user.playTime?.total)} />
            <Meta label="Paese" value={formatFlag(user.profile?.flag)} />
          </dl>
        </>
      )}

      {profileQuery.isError && (
        <ErrorState
          message={humanMessage(profileQuery.error)}
          onRetry={() => void profileQuery.refetch()}
        />
      )}
    </Card>
  );
}

function PresenceText({ friend }: { friend: Friend }) {
  const game = friend.status?.playing;

  switch (friend.presence) {
    case 'playing':
      return (
        <a
          href={`${LICHESS_ORIGIN}/${game?.id ?? ''}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-brand-400 hover:text-brand-300"
        >
          Sta giocando{game?.clock ? ` una ${game.clock}` : ''} →
        </a>
      );
    case 'streaming':
      return <span>In diretta streaming</span>;
    case 'online':
      return <span>Online adesso</span>;
    case 'offline':
      return (
        <span>
          {friend.user.seenAt ? `Visto ${formatRelative(friend.user.seenAt)} fa` : 'Offline'}
        </span>
      );
  }
}

/**
 * Testa a testa fra noi e il giocatore selezionato.
 *
 * Viene da `/api/crosstable`, che dà il totale già calcolato: ricavarlo dallo
 * storico partite significherebbe passare da `/api/games/user`, l'endpoint col
 * rate limit più severo dell'API, per un'informazione che Lichess espone in
 * una sola chiamata leggera.
 */
function Crosstable({
  query,
  meId,
  otherId,
  otherName,
}: {
  query: ReturnType<typeof useCrosstable>;
  meId: string | undefined;
  otherId: string;
  otherName: string;
}) {
  if (!meId || query.isError) return null;

  if (!query.data) {
    // `fetchStatus === 'idle'` a query pendente significa che la query è
    // disabilitata: non c'è niente in arrivo, e uno scheletro resterebbe lì
    // per sempre.
    return query.fetchStatus === 'idle' ? null : (
      <Skeleton className="h-[58px] w-full rounded-[10px]" />
    );
  }

  const total = query.data.nbGames;
  if (total === 0) {
    return (
      <p className="rounded-[10px] bg-(--surface-sunken) px-4 py-3 text-[12.5px] text-muted">
        Non avete mai giocato l’uno contro l’altro.
      </p>
    );
  }

  const { mine, theirs } = crosstableScore(query.data.users, meId, otherId);

  return (
    <div className="rounded-[10px] bg-(--surface-sunken) px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
          Testa a testa
        </span>
        <span className="tnum text-[12px] text-muted">
          {total.toLocaleString('it-IT')} {total === 1 ? 'partita' : 'partite'}
        </span>
      </div>
      <p className="mt-1.5 flex items-baseline gap-2 text-[20px] leading-none font-semibold">
        <span className={cn('tnum', mine > theirs && 'text-(--color-win)')}>
          {formatScore(mine)}
        </span>
        <span className="text-[14px] text-muted">–</span>
        <span className={cn('tnum', theirs > mine && 'text-(--color-loss)')}>
          {formatScore(theirs)}
        </span>
        <span className="ml-1 truncate text-[12px] font-normal text-muted">
          tu contro {otherName}
        </span>
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="text-[11px] font-medium tracking-wide text-muted uppercase">{children}</h3>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="tnum mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

/**
 * Punteggio del crosstable: le patte valgono mezzo punto, quindi i totali
 * possono essere frazionari. La notazione scacchistica è "5½", non "5.5".
 */
function formatScore(score: number): string {
  const whole = Math.floor(score);
  const hasHalf = score - whole >= 0.5;
  if (!hasHalf) return String(whole);
  return whole === 0 ? '½' : `${whole}½`;
}

function formatJoined(createdAt: number | undefined): string {
  if (!createdAt) return '—';
  return new Date(createdAt).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - 'A'.charCodeAt(0);

/**
 * Bandiera del profilo.
 *
 * `profile.flag` non è puramente ISO 3166-1: accanto ai codici a due lettere
 * Lichess ammette suddivisioni (`GB-ENG`) e valori speciali che iniziano con
 * un underscore (`_lichess`, `_earth`, `_pirate`), per i quali non esiste un
 * emoji. Convertiamo solo i codici a due lettere e mostriamo gli altri così
 * come sono, invece di produrre caratteri senza senso.
 */
function formatFlag(flag: string | undefined): string {
  if (!flag) return '—';
  if (flag.startsWith('_')) return '—';
  if (!/^[A-Z]{2}$/.test(flag)) return flag;

  const emoji = [...flag]
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET))
    .join('');
  return `${emoji} ${flag}`;
}

/** `playTime.total` è in secondi. Sotto l'ora i minuti dicono di più. */
function formatPlayTime(totalSeconds: number | undefined): string {
  if (!totalSeconds) return '—';
  const hours = Math.round(totalSeconds / 3600);
  if (hours < 1) return `${Math.round(totalSeconds / 60)} min`;
  return `${hours.toLocaleString('it-IT')} h`;
}
