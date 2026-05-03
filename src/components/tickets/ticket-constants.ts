import { Bug, HelpCircle, Sparkles, Clock, CheckCircle, Copy } from 'lucide-react';
import type { TicketType, TicketStatus } from '@/types';

export const TYPE_CONFIG: Record<TicketType, { icon: typeof Bug; label: string; color: string }> = {
  bug: { icon: Bug, label: 'Bug', color: 'bg-red-100 text-red-700' },
  question: { icon: HelpCircle, label: 'Question', color: 'bg-blue-100 text-blue-700' },
  improvement: { icon: Sparkles, label: 'Amélioration', color: 'bg-green-100 text-green-700' },
};

export const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Ouvert', color: 'bg-amber-100 text-amber-700', icon: Clock },
  closed_done: { label: 'Terminé', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed_duplicate: { label: 'Dupliqué', color: 'bg-gray-100 text-gray-600', icon: Copy },
};

export const MODULE_LABELS: Record<string, string> = {
  auth: 'Login / Inscription',
  characters: 'Personnages',
  places: 'Lieux',
  chapters: 'Chapitres / Scènes',
  timeline: 'Chronologie',
  writing: 'Mode écriture',
  reading: 'Mode lecture',
  progress: 'Progression',
  world: 'Univers & Glossaire',
  maps: 'Cartes',
  notes: 'Notes & Idées',
  reviews: 'Relectures',
  settings: 'Paramètres',
  export: 'Export',
  support: 'Aide & Support',
  other: 'Autre',
};

export const QUICK_REACTIONS = ['👍', '👎', '❤️', '🎉', '😕', '🔥'];
