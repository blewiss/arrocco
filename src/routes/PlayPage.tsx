import { useQuery } from '@tanstack/react-query';
import { Bot, Clock3, LogIn, Play, Users, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/auth/store';
import { cn } from '@/lib/cn';
import { createAiGame, fetchNowPlaying } from '@/lib/lichess/api';
import { humanMessage } from '@/lib/lichess/errors';
import { useSeek } from '@/lib/hooks/useSeek';
import { StorageKeys, readJson, writeJson } from '@/lib/storage';

/** Controlli di tempo offerti. `limit` in secondi, `increment` in secondi. */
const TIME_CONTROLS = [
  { label: '1+0', limitSeconds: 60, increment: 0, speed: 'Bullet' },
  { label: '3+0', limitSeconds: 180, increment: 0, speed: 'Blitz' },
  { label: '3+2', limitSeconds: 180, increment: 2, speed: 'Blitz' },
  { label: '5+0', limitSeconds: 300, increment: 0, speed: 'Blitz' },
  { label: '5+3', limitSeconds: 300, increment: 3, speed: 'Blitz' },
  { label: '10+0', limitSeconds: 600, increment: 0, speed: 'Rapid' },
  { label: '10+5', limitSeconds: 600, increment: 5, speed: 'Rapid' },
  { label: '15+10', limitSeconds: 900, increment: 10, speed: 'Rapid' },
] as const;

type ColorChoice = 'random' | 'white' | 'black';

interface PlayPrefs {
  timeIndex: number;
  aiLevel: number;
  color: ColorChoice;
  rated: boolean;
}

const DEFAULT_PREFS: PlayPrefs = { timeIndex: 3, aiLevel: 3, color: 'random', rated: false };

export function PlayPage() {
  const status = useAuth((state) => state.status);
  const login = useAuth((state) => state.login);
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState<PlayPrefs>(
    () => readJson<PlayPrefs>(StorageKeys.playPrefs) ?? DEFAULT_PREFS,
  );
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const updatePrefs = useCallback((patch: Partial<PlayPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writeJson(StorageKeys.playPrefs, next);
      return next;
    });
  }, []);

  const seek = useSeek(useCallback((gameId) => navigate(`/partita/${gameId}`), [navigate]));

  const ongoing = useQuery({
    queryKey: ['account', 'playing'],
    enabled: status === 'authenticated',
    queryFn: ({ signal }) => fetchNowPlaying(signal),
    // Le partite in corso vanno mostrate aggiornate: finestra breve.
    staleTime: 15_000,
  });

  const timeControl = TIME_CONTROLS[prefs.timeIndex] ?? TIME_CONTROLS[3];

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

      {/* Impostazioni condivise fra le due modalità */}
      <Card>
        <CardHeader title="Controllo di tempo" subtitle="Vale per entrambe le modalità" />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {TIME_CONTROLS.map((option, index) => (
            <button
              key={option.label}
              type="button"
              onClick={() => updatePrefs({ timeIndex: index })}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-[10px] border px-2 py-2.5 transition-colors',
                prefs.timeIndex === index
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-(--border-subtle) text-(--text-secondary) hover:border-(--border-strong) hover:text-(--text-primary)',
              )}
            >
              <span className="tnum text-[13px] font-semibold">{option.label}</span>
              <span className="text-[10px] text-muted">{option.speed}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Contro Stockfish ── */}
        <Card className="flex flex-col">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Bot className="size-4 text-brand-400" />
                Contro Stockfish
              </span>
            }
            subtitle="Nessuna attesa, inizia subito"
          />

          <div className="flex-1 space-y-5">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="ai-level" className="text-[13px] font-medium">
                  Livello
                </label>
                <span className="tnum text-[13px] font-semibold text-brand-400">
                  {prefs.aiLevel}
                  <span className="ml-1.5 text-[12px] font-normal text-muted">
                    {AI_LEVEL_HINTS[prefs.aiLevel]}
                  </span>
                </span>
              </div>
              <input
                id="ai-level"
                type="range"
                min={1}
                max={8}
                step={1}
                value={prefs.aiLevel}
                onChange={(event) => updatePrefs({ aiLevel: Number(event.target.value) })}
                className="w-full accent-brand-500"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted">
                <span>principiante</span>
                <span>esperto</span>
              </div>
            </div>

            <ColorPicker value={prefs.color} onChange={(color) => updatePrefs({ color })} />
          </div>

          {aiError && <ErrorState message={aiError} className="mt-4" />}

          <Button
            className="mt-5"
            fullWidth
            loading={aiBusy}
            icon={<Play className="size-4" />}
            onClick={() => void startAiGame()}
          >
            Gioca contro Stockfish
          </Button>
        </Card>

        {/* ── Avversario umano ── */}
        <Card className="flex flex-col">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Users className="size-4 text-brand-400" />
                Avversario umano
              </span>
            }
            subtitle="Cerca un giocatore nella lobby di Lichess"
          />

          <div className="flex-1 space-y-5">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium">Tipo di partita</legend>
              <div className="flex gap-2">
                {[
                  { value: false, label: 'Amichevole', hint: 'Non incide sul rating' },
                  { value: true, label: 'Valutata', hint: 'Modifica il tuo rating' },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => updatePrefs({ rated: option.value })}
                    className={cn(
                      'flex-1 rounded-[10px] border px-3 py-2.5 text-left transition-colors',
                      prefs.rated === option.value
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-(--border-subtle) hover:border-(--border-strong)',
                    )}
                  >
                    <span
                      className={cn(
                        'block text-[13px] font-medium',
                        prefs.rated === option.value
                          ? 'text-brand-400'
                          : 'text-(--text-secondary)',
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted">{option.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="rounded-[10px] bg-(--surface-sunken) px-3.5 py-3">
              <p className="text-[12px] leading-relaxed text-muted">
                Nella ricerca di un avversario umano il colore viene assegnato da Lichess, quindi
                la preferenza qui sopra non si applica.
              </p>
            </div>
          </div>

          {seek.error && <ErrorState message={seek.error} className="mt-4" />}

          <Button
            className="mt-5"
            fullWidth
            variant="secondary"
            icon={<Clock3 className="size-4" />}
            onClick={() =>
              seek.start({
                rated: prefs.rated,
                // L'endpoint seek vuole i minuti, non i secondi.
                timeMinutes: timeControl.limitSeconds / 60,
                incrementSeconds: timeControl.increment,
              })
            }
          >
            Cerca avversario
          </Button>
        </Card>
      </div>
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

function ColorPicker({
  value,
  onChange,
}: {
  value: ColorChoice;
  onChange: (color: ColorChoice) => void;
}) {
  const options: Array<{ value: ColorChoice; label: string; glyph: string }> = [
    { value: 'white', label: 'Bianco', glyph: '♔' },
    { value: 'random', label: 'Casuale', glyph: '⚄' },
    { value: 'black', label: 'Nero', glyph: '♚' },
  ];

  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium">Colore</legend>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-[10px] border py-2.5 transition-colors',
              value === option.value
                ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                : 'border-(--border-subtle) text-(--text-secondary) hover:border-(--border-strong)',
            )}
          >
            <span className="text-xl leading-none">{option.glyph}</span>
            <span className="text-[11.5px] font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

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
        <Users className="relative size-8 text-brand-400" />
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
