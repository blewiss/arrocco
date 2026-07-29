import { BookOpen, Compass, ExternalLink, GraduationCap, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { LICHESS_ORIGIN } from '@/lib/lichess/config';

/**
 * Sezione Risorse.
 *
 * Nella v1 non ci sono ancora contenuti propri: invece di una pagina vuota,
 * mostriamo la struttura prevista e i collegamenti agli strumenti di Lichess
 * che già coprono queste esigenze. Le categorie qui sotto sono i contenitori in
 * cui andranno le guide di Arrocco.
 */

interface ResourceCategory {
  icon: typeof BookOpen;
  title: string;
  description: string;
  /** Collegamenti a strumenti Lichess già disponibili nel frattempo. */
  links: Array<{ label: string; href: string }>;
}

const CATEGORIES: ResourceCategory[] = [
  {
    icon: GraduationCap,
    title: 'Fondamentali',
    description:
      'Come muovono i pezzi, i matti di base, il valore del materiale e i princìpi che governano le prime mosse.',
    links: [
      { label: 'Impara gli scacchi', href: `${LICHESS_ORIGIN}/learn` },
      { label: 'Coordinate', href: `${LICHESS_ORIGIN}/training/coordinate` },
    ],
  },
  {
    icon: Compass,
    title: 'Aperture',
    description:
      'Repertori ragionati, idee dietro le mosse principali e trappole ricorrenti da conoscere.',
    links: [
      { label: 'Esplora le aperture', href: `${LICHESS_ORIGIN}/opening` },
      { label: 'Analisi con database', href: `${LICHESS_ORIGIN}/analysis` },
    ],
  },
  {
    icon: Sparkles,
    title: 'Tattica e strategia',
    description:
      'Riconoscere i motivi tattici a colpo d’occhio e capire quando serve invece un piano a lungo termine.',
    links: [
      { label: 'Temi dei puzzle', href: `${LICHESS_ORIGIN}/training/themes` },
      { label: 'Studi della comunità', href: `${LICHESS_ORIGIN}/study` },
    ],
  },
  {
    icon: BookOpen,
    title: 'Finali',
    description:
      'Le posizioni che vale la pena sapere a memoria, e le tecniche per convertire un vantaggio.',
    links: [{ label: 'Pratica guidata', href: `${LICHESS_ORIGIN}/practice` }],
  },
];

export function ResourcesPage() {
  return (
    <div className="animate-in space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] leading-tight font-semibold tracking-tight md:text-[28px]">
            Risorse
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Guide e consigli per migliorare. Questa sezione è in costruzione.
          </p>
        </div>
        <Badge tone="brand">In arrivo</Badge>
      </header>

      <Card className="border-brand-500/25 bg-brand-500/6">
        <p className="text-[13.5px] leading-relaxed text-(--text-secondary)">
          Le guide di Arrocco arriveranno in una prossima versione. Qui sotto trovi le categorie
          previste e, nel frattempo, i collegamenti agli strumenti di Lichess che coprono gli
          stessi argomenti.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {CATEGORIES.map((category) => (
          <Card key={category.title} className="flex flex-col">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-500/10">
                <category.icon className="size-[18px] text-brand-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[14.5px] font-semibold">{category.title}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  {category.description}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 border-t border-(--border-subtle) pt-3.5">
              {category.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-400 transition-colors hover:text-brand-300"
                  >
                    {link.label}
                    <ExternalLink className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
