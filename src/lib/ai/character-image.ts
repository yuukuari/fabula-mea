/**
 * Construction du prompt pour la génération d'image de personnage.
 * Conserve la logique côté client : on envoie un prompt finalisé au serveur,
 * pas la fiche brute (limite l'exposition de données et reste explicite).
 */

import type { Character, AiImageStyle } from '@/types';
import { imageStyle } from './features';

const SEX_LABELS_EN: Record<string, string> = { male: 'man', female: 'woman' };

/**
 * Construit l'expression d'âge avec catégorie + cues visuels — Flux ignore
 * facilement un nombre isolé. On répète l'âge en lead, on ajoute une catégorie
 * narrative, et pour les âges hauts on injecte des indices physiques explicites
 * (rides, cheveux gris…) sinon le modèle revient à un visage par défaut jeune.
 */
function ageExpression(age: number, sexNoun: string): { lead: string; cues: string; tail: string } {
  // Pour les bébés/enfants, on remplace "X-year-old man/woman" par un noun adapté.
  let leadNoun = sexNoun;
  if (age < 1) leadNoun = 'newborn baby';
  else if (age <= 2) leadNoun = 'baby';
  else if (age <= 4) leadNoun = 'toddler';
  else if (age <= 11) leadNoun = sexNoun === 'man' ? 'boy' : sexNoun === 'woman' ? 'girl' : 'child';
  else if (age <= 17) leadNoun = sexNoun === 'man' ? 'teenage boy' : sexNoun === 'woman' ? 'teenage girl' : 'teenager';
  const lead = `${age}-year-old ${leadNoun}`;

  // Borne supérieure : serrée pour les jeunes (+2), 5 ans max pour les adultes.
  const upperBound = age + Math.max(2, Math.min(5, Math.round(age * 0.2)));
  const tail = `subject is exactly ${age} years old, looks ${age}, not older than ${age}, definitely not over ${upperBound}`;

  let cues = '';
  if (age < 1) cues = 'newborn infant, very smooth chubby cheeks, sparse fine hair or bald, big eyes, small button nose, baby proportions, infant features, no teeth visible';
  else if (age <= 2) cues = 'baby, smooth chubby cheeks, sparse fine baby hair, big curious eyes, baby proportions, no facial hair, no wrinkles';
  else if (age <= 4) cues = 'young toddler, soft round face, smooth chubby cheeks, fine hair, baby fat, child proportions, no facial hair';
  else if (age <= 9) cues = 'young child, youthful round face, completely smooth skin, milk teeth, no facial hair, no wrinkles, child proportions';
  else if (age <= 12) cues = 'child / pre-teen, youthful smooth skin, full hair, no facial hair, no wrinkles, child or pre-teen proportions';
  else if (age <= 15) cues = 'early teenager, youthful face, smooth skin, no wrinkles, no gray hair, sparse facial hair only if older male';
  else if (age <= 17) cues = 'older teenager, youthful face, smooth skin, no wrinkles, no gray hair, full thick hair, looks clearly under twenty';
  else if (age <= 22) cues = 'young adult in their late teens to early twenties, smooth fresh skin, no wrinkles, no gray hair, full thick hair, youthful glow';
  else if (age <= 30) cues = 'young adult in their twenties, youthful smooth skin, no wrinkles, no gray hair, full thick hair, looks clearly under thirty';
  else if (age <= 40) cues = 'adult in their thirties, smooth youthful skin, fit and youthful, full thick hair with no gray, no wrinkles or only the very faintest expression line, looks clearly in their thirties not their forties';
  else if (age <= 50) cues = 'adult in their forties, mostly smooth skin with subtle expression lines, slight crow\'s feet only when smiling, mostly dark hair maybe a few gray strands';
  else if (age <= 60) cues = 'middle-aged person in their fifties, visible expression lines, salt-and-pepper hair, mature but not elderly';
  else if (age <= 70) cues = 'older adult in their sixties, mostly graying hair, visible wrinkles, mature face, clear age signs';
  else if (age <= 80) cues = 'senior in their seventies, gray or white hair, deep wrinkles, weathered skin, some sagging';
  else if (age <= 90) cues = 'elderly person in their eighties, white hair, deep wrinkles across the face, frail features, weathered skin, age spots';
  else cues = 'very elderly over ninety, sparse white hair, very deep wrinkles, fragile features, weathered skin, prominent age spots, thin frail appearance';
  return { lead, cues, tail };
}

export interface BookContext {
  title?: string;
  genre?: string;
  synopsis?: string;
}

export interface BuildCharacterImagePromptInput {
  character: Character;
  /** Style prédéfini. Ignoré si `useReference` (l'image de référence porte le style). */
  style: AiImageStyle | null;
  /** Si true, on omet le médium dans le prompt (le style vient de l'image de référence). */
  useReference?: boolean;
  /** Métadonnées du livre auquel appartient le personnage (titre, genre, synopsis). */
  book?: BookContext;
  /** Texte libre additionnel saisi par l'utilisateur. */
  extraPrompt?: string;
}

/** Tronque proprement à la dernière fin de phrase pour limiter la taille du prompt. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastDot > max * 0.5 ? cut.slice(0, lastDot + 1) : cut) + '…';
}

export function buildCharacterImagePrompt({ character, style, useReference, book, extraPrompt }: BuildCharacterImagePromptInput): string {
  const styleDef = !useReference && style ? imageStyle(style) : null;
  const visualOnly = styleDef?.visualOnly ?? false;
  const parts: string[] = [];

  // 1. Style + sujet en tête (Flux pondère le début du prompt).
  //    Si une référence est utilisée, on omet le médium — il vient de l'image.
  const sexNoun = character.sex ? (SEX_LABELS_EN[character.sex] ?? 'person') : 'person';
  const ageExpr = typeof character.age === 'number' ? ageExpression(character.age, sexNoun) : null;
  const subjectStr = ageExpr ? ageExpr.lead : `a ${sexNoun}`;
  if (styleDef) {
    parts.push(`${styleDef.lead}, ${ageExpr ? '' : 'a '}${subjectStr}`);
  } else {
    parts.push(`Portrait of ${ageExpr ? '' : 'a '}${subjectStr}`);
  }
  if (ageExpr) parts.push(ageExpr.cues);

  // 2. Identité — uniquement utile en non-visualOnly (un nom n'aide pas une photo)
  if (!visualOnly) {
    const fullName = [character.name, character.surname].filter(Boolean).join(' ').trim();
    if (fullName || character.nickname || character.profession) {
      const identity: string[] = [];
      if (fullName) identity.push(`name: ${fullName}`);
      if (character.nickname) identity.push(`nickname: ${character.nickname}`);
      if (character.profession) identity.push(`profession: ${character.profession}`);
      parts.push(identity.join(', '));
    }
  } else if (character.profession) {
    // En mode photo, garder uniquement la profession (info visuelle utile)
    parts.push(character.profession);
  }

  // 3. Description physique (clé pour la ressemblance dans tous les modes)
  if (character.description?.trim()) parts.push(`Physical description: ${character.description.trim()}`);

  // 4. Traits & personnalité — pullent vers l'illustration narrative,
  //    on les évite en mode photo (visualOnly).
  if (!visualOnly) {
    const traitBits: string[] = [];
    if (character.qualities.length) traitBits.push(character.qualities.slice(0, 4).join(', '));
    if (character.flaws.length) traitBits.push(character.flaws.slice(0, 4).join(', '));
    if (character.personality?.trim()) traitBits.push(character.personality.trim());
    if (traitBits.length) parts.push(`Personality cues: ${traitBits.join('; ')}`);
  }

  // 5. Contexte livre — utile pour l'ambiance d'illustration ; ignoré en mode photo
  if (!visualOnly) {
    const bookBits: string[] = [];
    if (book?.genre?.trim()) bookBits.push(`genre ${book.genre.trim()}`);
    if (book?.title?.trim()) bookBits.push(`book "${book.title.trim()}"`);
    if (bookBits.length) parts.push(`Setting: ${bookBits.join(', ')}`);
    if (book?.synopsis?.trim()) parts.push(`Story atmosphere: ${truncate(book.synopsis.trim(), 400)}`);
  }

  // 6. Texte libre utilisateur
  if (extraPrompt?.trim()) parts.push(extraPrompt.trim());

  // 7. Cadrage + modificateurs de style en fin de prompt (renforcement).
  //    Pas de modificateurs en mode référence : l'image conditionne le rendu.
  parts.push('head and shoulders framing, centered composition, neutral background');
  if (styleDef) parts.push(styleDef.modifiers);
  // 8. Re-rappel de l'âge en queue avec borne supérieure (Flux pondère aussi la fin)
  if (ageExpr) parts.push(ageExpr.tail);
  // 9. En mode photo, dernier rappel anti-lissage : Flux a un fort biais beauté/glamour
  //    qui revient même avec les modificateurs en milieu de prompt.
  if (visualOnly) parts.push('natural unretouched look, no skin smoothing, no airbrushing');

  return parts.filter(Boolean).join('. ');
}
