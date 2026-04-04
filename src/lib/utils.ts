export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export const CHAPTER_COLORS = [
  '#8b2252', '#c4a35a', '#2d6a4f', '#1d3557', '#e76f51',
  '#6a4c93', '#1982c4', '#8ac926', '#ff595e', '#ffca3a',
  '#6b705c', '#cb997e', '#a8dadc', '#457b9d', '#e63946',
];

export const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  family: 'Famille',
  friend: 'Ami(e)',
  enemy: 'Ennemi(e)',
  lover: 'Amour',
  mentor: 'Mentor',
  rival: 'Rival(e)',
  colleague: 'Collègue',
  custom: 'Autre',
};

export const FAMILY_ROLE_LABELS: Record<string, string> = {
  pere: 'Père',
  mere: 'Mère',
  fils: 'Fils',
  fille: 'Fille',
  frere: 'Frère',
  soeur: 'Sœur',
  oncle: 'Oncle',
  tante: 'Tante',
  cousin: 'Cousin',
  cousine: 'Cousine',
  grand_pere: 'Grand-père',
  grand_mere: 'Grand-mère',
  petit_fils: 'Petit-fils',
  petite_fille: 'Petite-fille',
  epoux: 'Époux',
  epouse: 'Épouse',
  autre: 'Autre',
};

// Always-reciprocal relationship types (added on both characters automatically)
export const ALWAYS_RECIPROCAL_TYPES: string[] = ['friend', 'enemy', 'colleague', 'family'];

// For family: mapping of reverse roles
export const FAMILY_ROLE_REVERSE: Record<string, string> = {
  pere: 'fils',
  mere: 'fils', // will be adjusted to fille based on target sex
  fils: 'pere',
  fille: 'pere',
  frere: 'frere',
  soeur: 'soeur',
  oncle: 'neveu',
  tante: 'neveu',
  cousin: 'cousin',
  cousine: 'cousine',
  grand_pere: 'petit_fils',
  grand_mere: 'petit_fils',
  petit_fils: 'grand_pere',
  petite_fille: 'grand_pere',
  epoux: 'epouse',
  epouse: 'epoux',
  autre: 'autre',
};

export const PLACE_TYPE_LABELS: Record<string, string> = {
  city: 'Ville',
  village: 'Village',
  building: 'Bâtiment',
  room: 'Pièce',
  landscape: 'Paysage',
  country: 'Pays',
  region: 'Région',
  other: 'Autre',
};

export const SCENE_STATUS_LABELS: Record<string, string> = {
  outline: 'Plan',
  draft: 'Brouillon',
  revision: 'Révision',
  complete: 'Terminé',
};

export const SCENE_STATUS_COLORS: Record<string, string> = {
  outline: 'bg-parchment-300 text-ink-400',
  draft: 'bg-gold-200 text-gold-600',
  revision: 'bg-bordeaux-100 text-bordeaux-500',
  complete: 'bg-green-100 text-green-700',
};

export const WORLD_NOTE_CATEGORY_LABELS: Record<string, string> = {
  history: 'Histoire',
  culture: 'Culture',
  magic_system: 'Système de magie',
  politics: 'Politique',
  religion: 'Religion',
  technology: 'Technologie',
  flora_fauna: 'Faune & Flore',
  language: 'Langues',
  custom: 'Autre',
};

export const WORLD_NOTE_CATEGORY_COLORS: Record<string, string> = {
  history: 'bg-amber-100 text-amber-700',
  culture: 'bg-purple-100 text-purple-700',
  magic_system: 'bg-indigo-100 text-indigo-700',
  politics: 'bg-red-100 text-red-700',
  religion: 'bg-yellow-100 text-yellow-700',
  technology: 'bg-cyan-100 text-cyan-700',
  flora_fauna: 'bg-green-100 text-green-700',
  language: 'bg-pink-100 text-pink-700',
  custom: 'bg-gray-100 text-gray-600',
};

// ─── Duration helpers ───

export const DURATION_UNIT_LABELS: Record<string, string> = {
  hours: 'heure(s)',
  days: 'jour(s)',
  months: 'mois',
  years: 'année(s)',
};

/**
 * Convert a startDateTime + endDateTime (ISO strings) into a startDate + duration.
 * Used for migration from the old scene-based timeline to TimelineEvents.
 *
 * Rounding rules:
 * - ≤24h → keep in hours (rounded)
 * - >24h and ≤60 days → round to days (ceil)
 * - >60 days and ≤18 months → round to months
 * - >18 months → round to years
 */
export function convertToSimpleDuration(
  startDateTime: string,
  endDateTime?: string
): { startDate: string; startTime: string | undefined; duration: import('@/types').EventDuration } {
  const start = new Date(startDateTime);
  const end = endDateTime ? new Date(endDateTime) : new Date(start.getTime() + 3600000); // +1h default

  const startDate = startDateTime.slice(0, 10); // YYYY-MM-DD
  // Extract time if it's not midnight
  const hours = start.getHours();
  const minutes = start.getMinutes();
  const startTime = (hours !== 0 || minutes !== 0)
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    : undefined;

  const diffMs = Math.max(end.getTime() - start.getTime(), 0);
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  let duration: import('@/types').EventDuration;

  if (diffHours <= 24) {
    duration = { value: Math.max(1, Math.round(diffHours)), unit: 'hours' };
  } else if (diffDays <= 60) {
    duration = { value: Math.ceil(diffDays), unit: 'days' };
  } else if (diffDays <= 548) { // ~18 months
    duration = { value: Math.max(1, Math.round(diffDays / 30)), unit: 'months' };
  } else {
    duration = { value: Math.max(1, Math.round(diffDays / 365)), unit: 'years' };
  }

  return { startDate, startTime, duration };
}

/**
 * Compute the end date of a timeline event from its startDate + duration.
 * Returns a Date object.
 */
export function computeEventEndDate(
  startDate: string,
  startTime: string | undefined,
  duration: import('@/types').EventDuration
): Date {
  const dateStr = startTime ? `${startDate}T${startTime}:00` : `${startDate}T00:00:00`;
  const start = new Date(dateStr);

  switch (duration.unit) {
    case 'hours':
      return new Date(start.getTime() + duration.value * 3600000);
    case 'days': {
      const d = new Date(start);
      d.setDate(d.getDate() + duration.value);
      return d;
    }
    case 'months': {
      const d = new Date(start);
      d.setMonth(d.getMonth() + duration.value);
      return d;
    }
    case 'years': {
      const d = new Date(start);
      d.setFullYear(d.getFullYear() + duration.value);
      return d;
    }
  }
}

/**
 * Get the start Date of a timeline event.
 */
export function getEventStartDate(startDate: string, startTime?: string): Date {
  const dateStr = startTime ? `${startDate}T${startTime}:00` : `${startDate}T00:00:00`;
  return new Date(dateStr);
}

/**
 * Format a duration for display in French.
 */
export function formatDuration(duration: import('@/types').EventDuration): string {
  const v = duration.value;
  switch (duration.unit) {
    case 'hours': return v === 1 ? '1 heure' : `${v} heures`;
    case 'days': return v === 1 ? '1 jour' : `${v} jours`;
    case 'months': return `${v} mois`;
    case 'years': return v === 1 ? '1 an' : `${v} ans`;
  }
}

/** Count characters including spaces from HTML text */
export function countCharacters(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
  return text.length;
}

/** Count words from HTML text */
export function countWordsFromHtml(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').filter(Boolean).length;
}

/** Format count with unit label */
export function formatCount(value: number, unit: 'words' | 'characters'): string {
  return unit === 'characters'
    ? `${value.toLocaleString('fr-FR')} signes`
    : `${value.toLocaleString('fr-FR')} mots`;
}

/** Short unit label */
export function countUnitLabel(unit: 'words' | 'characters'): string {
  return unit === 'characters' ? 'signes' : 'mots';
}

// ─── Front/Back matter helpers ───

export const FRONT_MATTER_LABEL = 'Avant l\'histoire';
export const BACK_MATTER_LABEL = 'Après l\'histoire';
export const FRONT_MATTER_NUMBER = 0;
export const BACK_MATTER_NUMBER = 99999;
export const SPECIAL_CHAPTER_COLOR = '#9CA3AF'; // gray-400

/** Check if a chapter is front or back matter */
export function isSpecialChapter(chapter: { type?: string }): boolean {
  return chapter.type === 'front_matter' || chapter.type === 'back_matter';
}

/** Get the display label for a chapter */
export function getChapterLabel(chapter: { type?: string; number: number; title?: string }): string {
  if (chapter.type === 'front_matter') return FRONT_MATTER_LABEL;
  if (chapter.type === 'back_matter') return BACK_MATTER_LABEL;
  return `Chapitre ${chapter.number}${chapter.title ? ` — ${chapter.title}` : ''}`;
}

/** Get a short display label for a chapter (used in breadcrumbs) */
export function getChapterShortLabel(chapter: { type?: string; number: number; title?: string }): string {
  if (chapter.type === 'front_matter') return FRONT_MATTER_LABEL;
  if (chapter.type === 'back_matter') return BACK_MATTER_LABEL;
  return `Ch. ${chapter.number}${chapter.title ? ` — ${chapter.title}` : ''}`;
}
