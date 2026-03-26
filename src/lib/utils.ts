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
  colleague: 'Collegue',
  custom: 'Autre',
};

export const PLACE_TYPE_LABELS: Record<string, string> = {
  city: 'Ville',
  village: 'Village',
  building: 'Batiment',
  room: 'Piece',
  landscape: 'Paysage',
  country: 'Pays',
  region: 'Region',
  other: 'Autre',
};

export const SCENE_STATUS_LABELS: Record<string, string> = {
  outline: 'Plan',
  draft: 'Brouillon',
  revision: 'Revision',
  complete: 'Termine',
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
  magic_system: 'Systeme de magie',
  politics: 'Politique',
  religion: 'Religion',
  technology: 'Technologie',
  flora_fauna: 'Flore & Faune',
  language: 'Langues',
  custom: 'Autre',
};
