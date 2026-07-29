import { Hourglass } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cooldownRemainingMs, onCooldownChange } from '@/lib/lichess/queue';

/**
 * Avvisa quando Lichess ha applicato un rate limit.
 *
 * Arrocco non fallisce: il limiter mette in pausa le richieste e riprende da
 * solo. Questo banner esiste perché l'utente capisca perché i dati sembrano
 * fermi, invece di credere che l'app sia rotta.
 */
export function RateLimitBanner() {
  const [remaining, setRemaining] = useState(cooldownRemainingMs);
  const active = remaining > 0;

  useEffect(() => onCooldownChange(setRemaining), []);

  // Il conto alla rovescia va aggiornato mentre scorre, ma il timer esiste solo
  // durante il cooldown: a riposo il componente non fa nulla.
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setRemaining(cooldownRemainingMs()), 500);
    return () => window.clearInterval(interval);
  }, [active]);

  if (!active) return null;

  const seconds = Math.ceil(remaining / 1000);

  return (
    <div
      role="status"
      className="mx-auto flex max-w-[1180px] items-center gap-2.5 px-4 pt-4 md:px-8"
    >
      <div className="flex w-full items-center gap-2.5 rounded-[10px] border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5">
        <Hourglass className="size-4 shrink-0 text-amber-500" />
        <p className="text-[13px] text-(--text-secondary)">
          Lichess ha applicato un limite di frequenza. Arrocco riprende
          automaticamente fra <span className="tnum font-medium">{seconds}s</span>.
        </p>
      </div>
    </div>
  );
}
