import { Archive, BookOpen, LayoutDashboard, Puzzle, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import { KnightIcon, type IconComponentProps } from '@/components/ui/icons';

/**
 * Le voci mescolano icone lucide e icone nostre (vedi `components/ui/icons`),
 * quindi il tipo è la firma minima che la sidebar usa davvero invece di
 * `LucideIcon`, che escluderebbe le seconde.
 */
export type NavIcon = ComponentType<IconComponentProps>;

export interface NavItem {
  to: string;
  label: string;
  icon: NavIcon;
  /** Descrizione mostrata nel tooltip a sidebar compressa. */
  hint: string;
  /** Sezioni che richiedono il login per essere utili. */
  requiresAuth?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/',
    label: 'Home',
    icon: LayoutDashboard,
    hint: 'Panoramica della tua attività',
  },
  {
    to: '/gioca',
    label: 'Gioca',
    icon: KnightIcon,
    hint: 'Inizia una nuova partita',
    requiresAuth: true,
  },
  {
    to: '/puzzle',
    label: 'Puzzle',
    icon: Puzzle,
    hint: 'Allenati con i puzzle di Lichess',
  },
  {
    to: '/amici',
    label: 'Amici',
    icon: Users,
    hint: 'I giocatori che segui, e chi è online',
    requiresAuth: true,
  },
  {
    to: '/risorse',
    label: 'Risorse',
    icon: BookOpen,
    hint: 'Guide e consigli',
  },
  {
    to: '/archivio',
    label: 'Archivio',
    icon: Archive,
    hint: 'Tutto il tuo storico partite',
    requiresAuth: true,
  },
] as const;
