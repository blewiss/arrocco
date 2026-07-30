import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, LogIn, Play, Search, Users, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import {
  BulletIcon,
  ClockIcon,
  KnightIcon,
  ThunderIcon,
  type IconComponentProps,
} from '@/components/ui/icons';
import { useAuth } from '@/lib/auth/store';
import { cn } from '@/lib/cn';
import { createAiGame, fetchNowPlaying } from '@/lib/lichess/api';
import { humanMessage } from '@/lib/lichess/errors';
import { useSeek } from '@/lib/hooks/useSeek';
import { gameQueryKeys } from '@/lib/queryKeys';
import { StorageKeys, readJson, writeJson } from '@/lib/storage';

type Family = 'bullet' | 'blitz' | 'rapid';
type Opponent = 'ai' | 'human';
type ColorChoice = 'random' | 'white' | 'black';

/** Controlli di tempo offerti. `limitSeconds` e `increment` in secondi. */
const TIME_CONTROLS = [
  { label: '1+0', limitSeconds: 60, increment: 0, family: 'bullet' },
  { label: '2+1', limitSeconds: 120, increment: 1, family: 'bullet' },
  { label: '3+0', limitSeconds: 180, increment: 0, family: 'blitz' },
  { label: '3+2', limitSeconds: 180, increment: 2, family: 'blitz' },
  { label: '5+0', limitSeconds: 300, increment: 0, family: 'blitz' },
  { label: '5+3', limitSeconds: 300, increment: 3, family: 'blitz' },
  { label: '10+0', limitSeconds: 600, increment: 0, family: 'rapid' },
  { label: '10+5', limitSeconds: 600, increment: 5, family: 'rapid' },
  { label: '15+10', limitSeconds: 900, increment: 10, family: 'rapid' },
] as const satisfies ReadonlyArray<{
  label: string;
  limitSeconds: number;
  increment: number;
  family: Family;
}>;

type TimeControl = (typeof TIME_CONTROLS)[number];

const FAMILIES: ReadonlyArray<{
  key: Family;
  label: string;
  icon: (props: IconComponentProps) => React.ReactElement;
}> = [
  { key: 'bullet', label: 'Bullet', icon: BulletIcon },
  { key: 'blitz', label: 'Blitz', icon: ThunderIcon },
  { key: 'rapid', label: 'Rapid', icon: ClockIcon },
];

interface PlayPrefs {
  opponent: Opponent;
  /** Il controllo di tempo è salvato per etichetta e non per indice: così
   *  aggiungere una cadenza all'elenco non cambia la scelta di chi ha già
   *  giocato. */
  timeLabel: string;
  aiLevel: number;
  color: ColorChoice;
  rated: boolean;
}

const DEFAULT_PREFS: PlayPrefs = {
  opponent: 'ai',
  timeLabel: '5+0',
  aiLevel: 3,
  color: 'random',
  rated: false,
};

function timeControlFor(label: string): TimeControl {
  return (
    TIME_CONTROLS.find((option) => option.label === label) ??
    (TIME_CONTROLS.find((option) => option.label === DEFAULT_PREFS.timeLabel) as TimeControl)
  );
}

/**
 * Preferenze salvate, ripulite.
 *
 * Le versioni precedenti di questa pagina salvavano `timeIndex`, che qui non
 * esiste più: i campi mancanti o non riconosciuti tornano al default invece di
 * propagarsi come `undefined` dentro la UI.
 */
function loadPrefs(): PlayPrefs {
  const stored = readJson<Partial<PlayPrefs>>(StorageKeys.playPrefs);
  if (!stored) return DEFAULT_PREFS;

  return {
    opponent: stored.opponent === 'human' ? 'human' : DEFAULT_PREFS.opponent,
    timeLabel: timeControlFor(stored.timeLabel ?? '').label,
    aiLevel:
      typeof stored.aiLevel === 'number' && stored.aiLevel >= 1 && stored.aiLevel <= 8
        ? stored.aiLevel
        : DEFAULT_PREFS.aiLevel,
    color:
      stored.color === 'white' || stored.color === 'black'
        ? stored.color
        : DEFAULT_PREFS.color,
    rated: stored.rated === true,
  };
}

export function PlayPage() {
  const status = useAuth((state) => state.status);
  const login = useAuth((state) => state.login);
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState<PlayPrefs>(loadPrefs);
  // La famiglia non è una preferenza da salvare: è già implicita nella cadenza
  // scelta, e tenerla derivata evita che le due possano divergere.
  const [family, setFamily] = useState<Family>(() => timeControlFor(prefs.timeLabel).family);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const updatePrefs = useCallback((patch: Partial<PlayPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writeJson(StorageKeys.playPrefs, next);
      return next;
    });
  }, []);

  const queryClient = useQueryClient();

  const seek = useSeek(
    useCallback(
      (gameId) => {
        void queryClient.invalidateQueries({ queryKey: gameQueryKeys.playing });
        navigate(`/partita/${gameId}`);
      },
      [navigate, queryClient],
    ),
  );

  const ongoing = useQuery({
    queryKey: gameQueryKeys.playing,
    enabled: status === 'authenticated',
    queryFn: ({ signal }) => fetchNowPlaying(signal),
    // Le partite in corso vanno mostrate aggiornate: finestra breve.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const timeControl = timeControlFor(prefs.timeLabel);

  const startAiGame = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const game = await createAiGame({
        level: prefs.aiLevel,
        clockLimitSeconds: timeControl.limitSeconds,
        clockIncrementSeconds: timeControl.increment,
        color: prefs.color,
      });
      void queryClient.invalidateQueries({ queryKey: gameQueryKeys.playing });
      navigate(`/partita/${game.id}`);
    } catch (error) {
      setAiError(humanMessage(error));
    } finally {
      setAiBusy(false);
    }
  };

  if (status !== 'authenticated') {
    return (
      <div className="animate-in">
        <PageHeader />
        <Card className="mt-6">
          <EmptyState
            icon={<LogIn className="size-5" />}
            title="Accedi per giocare"
            description="Per creare partite su Lichess serve il permesso del tuo account."
            action={<Button onClick={() => void login()}>Accedi con Lichess</Button>}
          />
        </Card>
      </div>
    );
  }

  // Durante la ricerca la pagina diventa una schermata d'attesa dedicata:
  // mostrare i form sarebbe fuorviante, dato che una partita può iniziare da un
  // momento all'altro.
  if (seek.status === 'searching' || seek.status === 'matched') {
    return <SearchingScreen seek={seek} timeLabel={timeControl.label} rated={prefs.rated} />;
  }

  const againstAi = prefs.opponent === 'ai';
  const error = againstAi ? aiError : seek.error;

  return (
    <div className="animate-in space-y-6">
      <PageHeader />

      {ongoing.data && ongoing.data.nowPlaying.length > 0 && (
        <Card>
          <CardHeader title="Partite in corso" subtitle="Riprendi da dove hai lasciato" />
          <ul className="-mx-1.5 space-y-0.5">
            {ongoing.data.nowPlaying.map((game) => (
              <li key={game.gameId}>
                <button
                  type="button"
                  onClick={() => navigate(`/partita/${game.gameId}`)}
                  className="flex w-full items-center gap-3 rounded-[10px] px-1.5 py-2.5 text-left transition-colors hover:bg-(--surface-raised)"
                >
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      game.isMyTurn ? 'bg-(--color-win)' : 'bg-(--border-strong)',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {game.opponent.ai !== undefined
                        ? `Stockfish liv. ${game.opponent.ai}`
                        : game.opponent.username}
                    </span>
                    <span className="text-[12px] text-muted">
                      {game.isMyTurn ? 'Tocca a te' : 'Attendi l’avversario'}
                    </span>
                  </span>
                  <Badge tone={game.isMyTurn ? 'brand' : 'neutral'}>{game.speed}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Tutte le scelte restano sulla stessa colonna e sempre visibili: si
          scorre dall'alto in basso la prima volta, e le volte successive si
          cambia solo la riga che interessa senza attraversare le altre. */}
      <Card className="space-y-6">
        <Section label="Avversario">
          <div className="grid grid-cols-2 gap-2.5">
            <OptionTile
              icon={<Bot className="size-[18px]" />}
              label="Stockfish"
              hint="Inizia subito"
              selected={againstAi}
              onClick={() => updatePrefs({ opponent: 'ai' })}
            />
            <OptionTile
              icon={<Users className="size-[18px]" />}
              label="Umano"
              hint="Cerca nella lobby"
              selected={!againstAi}
              onClick={() => updatePrefs({ opponent: 'human' })}
            />
          </div>
        </Section>

        <Section
          label="Tempo"
          hint="Minuti iniziali + secondi aggiunti a ogni mossa"
        >
          <div className="grid grid-cols-3 gap-2.5">
            {FAMILIES.map((option) => (
              <OptionTile
                key={option.key}
                icon={<option.icon className="size-[18px]" />}
                label={option.label}
                selected={family === option.key}
                onClick={() => setFamily(option.key)}
              />
            ))}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {TIME_CONTROLS.filter((option) => option.family === family).map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => updatePrefs({ timeLabel: option.label })}
                aria-pressed={prefs.timeLabel === option.label}
                className={cn(
                  'tnum rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors',
                  prefs.timeLabel === option.label
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                    : 'border-(--border-subtle) text-(--text-secondary) hover:border-(--border-strong) hover:text-(--text-primary)',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Section>

        {againstAi ? (
          <>
            <Section label="Livello" value={AI_LEVEL_HINTS[prefs.aiLevel]}>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={prefs.aiLevel}
                aria-label="Livello di Stockfish"
                onChange={(event) => updatePrefs({ aiLevel: Number(event.target.value) })}
                className="w-full accent-brand-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted">
                <span>principiante</span>
                <span>esperto</span>
              </div>
            </Section>

            <Section label="Colore">
              <div className="grid grid-cols-3 gap-2.5">
                {COLOR_OPTIONS.map((option) => (
                  <OptionTile
                    key={option.value}
                    icon={<span className="text-[17px] leading-none">{option.glyph}</span>}
                    label={option.label}
                    selected={prefs.color === option.value}
                    onClick={() => updatePrefs({ color: option.value })}
                  />
                ))}
              </div>
            </Section>
          </>
        ) : (
          <Section
            label="Tipo di partita"
            hint="Nella lobby il colore lo assegna Lichess"
          >
            <div className="grid grid-cols-2 gap-2.5">
              <OptionTile
                label="Amichevole"
                hint="Non incide sul rating"
                selected={!prefs.rated}
                onClick={() => updatePrefs({ rated: false })}
              />
              <OptionTile
                label="Valutata"
                hint="Modifica il tuo rating"
                selected={prefs.rated}
                onClick={() => updatePrefs({ rated: true })}
              />
            </div>
          </Section>
        )}

        {error && <ErrorState message={error} />}

        <div className="border-t border-(--border-subtle) pt-5">
          <Button
            fullWidth
            size="lg"
            loading={againstAi && aiBusy}
            icon={
              againstAi ? <Play className="size-4" /> : <Search className="size-4" />
            }
            onClick={() =>
              againstAi
                ? void startAiGame()
                : seek.start({
                    rated: prefs.rated,
                    // L'endpoint seek vuole i minuti, non i secondi.
                    timeMinutes: timeControl.limitSeconds / 60,
                    incrementSeconds: timeControl.increment,
                  })
            }
          >
            {againstAi ? 'Gioca contro Stockfish' : 'Cerca avversario'}
          </Button>
          {/* Riepilogo sotto il pulsante: alla fine della colonna le scelte
              fatte in alto sono fuori vista, e questa riga evita di risalire
              per controllarle. */}
          <p className="tnum mt-2.5 text-center text-[12px] text-muted">
            {againstAi
              ? `Livello ${prefs.aiLevel} · ${timeControl.label} · ${COLOR_SUMMARY[prefs.color]}`
              : `${timeControl.label} · ${prefs.rated ? 'valutata' : 'amichevole'}`}
          </p>
        </div>
      </Card>
    </div>
  );
}

function PageHeader() {
  return (
    <header>
      <h1 className="text-[24px] leading-tight font-semibold tracking-tight md:text-[28px]">
        Gioca
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Sfida Stockfish o cerca un avversario nella lobby di Lichess.
      </p>
    </header>
  );
}

/**
 * Un blocco di scelta della colonna: etichetta a sinistra, valore corrente a
 * destra. Il valore è ridondante rispetto ai controlli sotto, ma tiene la
 * scelta leggibile anche di sfuggita, scorrendo la pagina.
 */
function Section({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</h2>
        {value && <span className="text-[12px] font-medium text-brand-400">{value}</span>}
        {hint && !value && <span className="truncate text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Riquadro selezionabile: icona, etichetta e sottotitolo facoltativo.
 *
 * È la forma unica di tutte le scelte della pagina — avversario, cadenza,
 * colore, tipo di partita — perché sono decisioni dello stesso peso e
 * differenziarle graficamente suggerirebbe una gerarchia che non c'è.
 */
function OptionTile({
  icon,
  label,
  hint,
  selected,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-brand-500 bg-brand-500/10'
          : 'border-(--border-subtle) hover:border-(--border-strong) hover:bg-(--surface-raised)',
      )}
    >
      {icon && (
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center',
            selected ? 'text-brand-400' : 'text-(--text-secondary)',
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span
          className={cn(
            'block truncate text-[13px] font-medium',
            selected ? 'text-brand-400' : 'text-(--text-primary)',
          )}
        >
          {label}
        </span>
        {hint && <span className="block truncate text-[11px] text-muted">{hint}</span>}
      </span>
    </button>
  );
}

const AI_LEVEL_HINTS: Record<number, string> = {
  1: 'molto facile',
  2: 'facile',
  3: 'accessibile',
  4: 'medio',
  5: 'impegnativo',
  6: 'difficile',
  7: 'molto difficile',
  8: 'massimo',
};

const COLOR_OPTIONS: ReadonlyArray<{ value: ColorChoice; label: string; glyph: string }> = [
  { value: 'white', label: 'Bianco', glyph: '♔' },
  { value: 'random', label: 'Casuale', glyph: '⚄' },
  { value: 'black', label: 'Nero', glyph: '♚' },
];

const COLOR_SUMMARY: Record<ColorChoice, string> = {
  white: 'con il bianco',
  black: 'con il nero',
  random: 'colore casuale',
};

function SearchingScreen({
  seek,
  timeLabel,
  rated,
}: {
  seek: ReturnType<typeof useSeek>;
  timeLabel: string;
  rated: boolean;
}) {
  return (
    <div className="animate-in flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="relative flex size-20 items-center justify-center">
        {/* Due anelli pulsanti sfasati: comunicano attesa attiva senza spinner */}
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />
        <span
          className="absolute inset-2 animate-ping rounded-full bg-brand-500/25"
          style={{ animationDelay: '0.4s' }}
        />
        <KnightIcon className="relative size-8 text-brand-400" />
      </div>

      <div>
        <h1 className="text-xl font-semibold">
          {seek.status === 'matched' ? 'Avversario trovato!' : 'Cerco un avversario…'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {timeLabel} · {rated ? 'valutata' : 'amichevole'}
          {seek.status === 'searching' && (
            <>
              {' · '}
              <span className="tnum">{seek.elapsedSeconds}s</span>
            </>
          )}
        </p>
      </div>

      {seek.status === 'searching' && (
        <>
          <p className="max-w-sm text-[13px] leading-relaxed text-muted">
            Sei nella lobby di Lichess. La partita inizierà automaticamente appena qualcuno
            accetta il tuo tempo di gioco.
          </p>
          <Button variant="secondary" icon={<X className="size-4" />} onClick={seek.cancel}>
            Annulla ricerca
          </Button>
        </>
      )}
    </div>
  );
}
