/**
 * Conformity engine: checks a BookProject against print and digital readiness
 * criteria. Returns a list of typed checks with status + remediation hints.
 */
import type { BookProject, Chapter, Scene } from '@/types';
import { totalScenesCount } from '@/lib/utils';
import { DEFAULT_LAYOUT } from '@/lib/fonts';
import { estimatePageCount, calculateSpineWidth } from '@/lib/print-edition';

export type ConformityStatus = 'pass' | 'warning' | 'error' | 'info';

export type ConformityCategory = 'common' | 'print' | 'digital';

export interface ConformityAction {
  label: string;
  to: string;        // router path to navigate to
}

export interface ConformityCheck {
  id: string;
  category: ConformityCategory;
  title: string;
  status: ConformityStatus;
  message: string;
  solution?: string;
  action?: ConformityAction;
}

/**
 * Input shape compatible with BookProject fields we need.
 * We accept a subset so this is easy to call with useBookStore.getState().
 */
export interface ConformityInput {
  title?: string;
  author?: string;
  chapters: Chapter[];
  scenes: Scene[];
  countUnit?: 'words' | 'characters';
  layout?: BookProject['layout'];
  glossaryEnabled?: boolean;
  tableOfContents?: boolean;
}

function validateIsbn(isbn: string): boolean {
  const digits = isbn.replace(/[^0-9X]/gi, '');
  return digits.length === 10 || digits.length === 13;
}

/** Core function: return a list of conformity checks. */
export function checkConformity(input: ConformityInput): ConformityCheck[] {
  const checks: ConformityCheck[] = [];
  const layout = input.layout;
  const countUnit = input.countUnit ?? 'words';

  // ─── Common ───

  // Title + author
  if (!input.title?.trim()) {
    checks.push({
      id: 'title-missing',
      category: 'common',
      title: 'Titre du livre',
      status: 'error',
      message: 'Aucun titre renseigné.',
      solution: 'Renseignez un titre pour votre livre.',
      action: { label: 'Paramètres', to: '/settings' },
    });
  } else {
    checks.push({
      id: 'title',
      category: 'common',
      title: 'Titre du livre',
      status: 'pass',
      message: `« ${input.title} »`,
    });
  }

  if (!input.author?.trim()) {
    checks.push({
      id: 'author-missing',
      category: 'common',
      title: 'Auteur',
      status: 'warning',
      message: 'Aucun auteur renseigné.',
      solution: "Renseignez un nom d'auteur pour l'affichage dans le livre et les exports.",
      action: { label: 'Paramètres', to: '/settings' },
    });
  } else {
    checks.push({
      id: 'author',
      category: 'common',
      title: 'Auteur',
      status: 'pass',
      message: input.author,
    });
  }

  // Content
  const realChapters = input.chapters.filter((c) => c.type === 'chapter');
  const scenesCount = input.scenes.length;
  if (realChapters.length === 0) {
    checks.push({
      id: 'no-chapters',
      category: 'common',
      title: 'Contenu',
      status: 'error',
      message: 'Aucun chapitre dans le livre.',
      solution: "Ajoutez au moins un chapitre avec du contenu avant d'exporter.",
      action: { label: 'Chapitres', to: '/chapters' },
    });
  } else if (scenesCount === 0) {
    checks.push({
      id: 'no-scenes',
      category: 'common',
      title: 'Contenu',
      status: 'error',
      message: 'Aucune scène.',
      solution: 'Ajoutez des scènes à vos chapitres.',
      action: { label: 'Chapitres', to: '/chapters' },
    });
  } else {
    // Count total (words or characters depending on countUnit)
    const totalCount = totalScenesCount(input.scenes, countUnit);
    const unitLabel = countUnit === 'words' ? 'mots' : 'signes';
    checks.push({
      id: 'content',
      category: 'common',
      title: 'Contenu',
      status: totalCount < 1000 ? 'warning' : 'pass',
      message: `${realChapters.length} chapitre${realChapters.length > 1 ? 's' : ''} · ${scenesCount} scène${scenesCount > 1 ? 's' : ''} · ${totalCount.toLocaleString('fr-FR')} ${unitLabel}`,
      solution: totalCount < 1000 ? 'Votre livre semble très court. Vérifiez que tout le contenu est bien présent.' : undefined,
    });
  }

  // Scene statuses
  const incompleteScenes = input.scenes.filter((s) => s.status === 'outline' || s.status === 'draft');
  if (incompleteScenes.length > 0 && scenesCount > 0) {
    checks.push({
      id: 'scenes-incomplete',
      category: 'common',
      title: 'Scènes à finaliser',
      status: 'info',
      message: `${incompleteScenes.length} scène${incompleteScenes.length > 1 ? 's' : ''} encore au statut « plan » ou « brouillon ».`,
      solution: 'Ces scènes seront exportées telles quelles. Finalisez-les pour une version définitive.',
      action: { label: 'Chapitres', to: '/chapters' },
    });
  }

  // Layout
  if (!layout?.fontFamily) {
    checks.push({
      id: 'layout-default',
      category: 'common',
      title: 'Mise en page',
      status: 'info',
      message: 'Utilisation des valeurs par défaut (Times New Roman 12 pt, interligne 1.5).',
      action: { label: 'Mise en page', to: '/edition/layout' },
    });
  } else {
    checks.push({
      id: 'layout',
      category: 'common',
      title: 'Mise en page',
      status: 'pass',
      message: `${layout.fontFamily} · ${layout.fontSize} pt · interligne ${layout.lineHeight}`,
    });
  }

  // ─── Print ───
  const pe = layout?.printEdition;

  if (!pe) {
    checks.push({
      id: 'print-not-configured',
      category: 'print',
      title: 'Édition papier',
      status: 'info',
      message: 'Édition papier non configurée.',
      solution: "Configurez le format, le papier et les marges pour préparer un PDF prêt à imprimer. Tant que ce n'est pas fait, le PDF utilisera le format A5 par défaut.",
      action: { label: 'Configurer', to: '/edition/print' },
    });
  } else {
    // Inner margin for binding
    if (pe.margins.innerMm < 15) {
      checks.push({
        id: 'print-inner-margin',
        category: 'print',
        title: 'Marge intérieure (reliure)',
        status: 'warning',
        message: `Marge intérieure : ${pe.margins.innerMm} mm (recommandé : 15 mm minimum).`,
        solution: "Une marge intérieure trop faible risque de rendre le texte difficile à lire près de la reliure. Augmentez-la dans l'édition papier.",
        action: { label: 'Ajuster', to: '/edition/print' },
      });
    } else {
      checks.push({
        id: 'print-inner-margin',
        category: 'print',
        title: 'Marge intérieure',
        status: 'pass',
        message: `${pe.margins.innerMm} mm — confortable pour la reliure.`,
      });
    }

    // Bleed
    if (pe.bleedMm < 3) {
      checks.push({
        id: 'print-bleed',
        category: 'print',
        title: 'Fond perdu',
        status: 'warning',
        message: `Fond perdu : ${pe.bleedMm} mm (standard : 3 mm).`,
        solution: 'Un fond perdu insuffisant peut laisser des bandes blanches après la coupe. Augmentez-le à 3 mm minimum.',
        action: { label: 'Ajuster', to: '/edition/print' },
      });
    }

    // ISBN validity
    if (pe.isbn) {
      if (!validateIsbn(pe.isbn)) {
        checks.push({
          id: 'print-isbn',
          category: 'print',
          title: 'ISBN papier',
          status: 'error',
          message: `ISBN invalide : « ${pe.isbn} » (doit contenir 10 ou 13 chiffres).`,
          solution: "Corrigez le format de l'ISBN.",
          action: { label: 'Modifier', to: '/edition/print' },
        });
      } else {
        checks.push({
          id: 'print-isbn',
          category: 'print',
          title: 'ISBN papier',
          status: 'pass',
          message: pe.isbn,
        });
      }
    }

    // Page count multiple of 4
    if (realChapters.length > 0) {
      const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
      const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
      // estimatePageCount expects a word count — always compute in words here
      const totalWords = totalScenesCount(input.scenes, 'words');
      const pageCount = estimatePageCount(totalWords, pe.trimSize, fontSize, lineHeight, pe.margins, realChapters.length);
      const spine = calculateSpineWidth(pageCount, pe.paperType);
      const signatureOk = pageCount % 4 === 0;
      checks.push({
        id: 'print-page-count',
        category: 'print',
        title: 'Nombre de pages estimé',
        status: signatureOk ? 'pass' : 'info',
        message: `~${pageCount} pages · dos ~${spine} mm (±10 %)`,
        solution: signatureOk ? undefined : "L'imprimeur ajoutera automatiquement des pages vierges pour arriver à un multiple de 4 (cahier d'impression).",
      });

      if (pageCount < 24) {
        checks.push({
          id: 'print-too-short',
          category: 'print',
          title: 'Livre très court',
          status: 'warning',
          message: `${pageCount} pages estimées — certains imprimeurs ont un minimum de 24 ou 32 pages.`,
          solution: "Vérifiez les exigences minimales de votre imprimeur (Coollibri : 24 pages, KDP : 24 pages, IngramSpark : 18 pages).",
        });
      }
    }

    // Covers (only checked when print edition is configured)
    const hasCoverFront = !!layout?.coverFront;
    const hasCoverBack = !!layout?.coverBack;
    if (!hasCoverFront && !hasCoverBack) {
      checks.push({
        id: 'print-covers-missing',
        category: 'print',
        title: 'Couvertures',
        status: 'warning',
        message: 'Aucune couverture uploadée.',
        solution: "Ajoutez au moins la 1ère de couverture. Des placeholders seront utilisés à défaut.",
        action: { label: 'Couvertures', to: '/edition/covers' },
      });
    } else if (!hasCoverFront) {
      checks.push({
        id: 'print-cover-front-missing',
        category: 'print',
        title: '1ère de couverture',
        status: 'warning',
        message: 'Manquante (seulement la 4ème est uploadée).',
        action: { label: 'Ajouter', to: '/edition/covers' },
      });
    } else if (!hasCoverBack) {
      checks.push({
        id: 'print-cover-back-missing',
        category: 'print',
        title: '4ème de couverture',
        status: 'info',
        message: 'Manquante. La 4ème de couverture est optionnelle mais recommandée.',
        action: { label: 'Ajouter', to: '/edition/covers' },
      });
    } else {
      checks.push({
        id: 'print-covers',
        category: 'print',
        title: 'Couvertures',
        status: 'pass',
        message: '1ère et 4ème de couverture uploadées.',
      });
    }
  }

  // ─── Digital ───
  const de = layout?.digitalEdition;

  if (de?.isbnDigital && !validateIsbn(de.isbnDigital)) {
    checks.push({
      id: 'digital-isbn',
      category: 'digital',
      title: 'ISBN numérique',
      status: 'error',
      message: `ISBN invalide : « ${de.isbnDigital} ».`,
      solution: "L'ISBN doit contenir 10 ou 13 chiffres.",
      action: { label: 'Modifier', to: '/edition/digital' },
    });
  } else if (de?.isbnDigital) {
    checks.push({
      id: 'digital-isbn',
      category: 'digital',
      title: 'ISBN numérique',
      status: 'pass',
      message: de.isbnDigital,
    });
  }

  if (!de?.description && !de?.keywords?.length) {
    checks.push({
      id: 'digital-metadata-minimal',
      category: 'digital',
      title: 'Métadonnées numériques',
      status: 'info',
      message: 'Peu de métadonnées pour les boutiques en ligne.',
      solution: "Ajouter une description longue et des mots-clés améliore le référencement sur Amazon, Apple Books, Kobo.",
      action: { label: 'Compléter', to: '/edition/digital' },
    });
  } else {
    const parts: string[] = [];
    if (de?.description) parts.push(`description (${de.description.length} car.)`);
    if (de?.keywords?.length) parts.push(`${de.keywords.length} mot${de.keywords.length > 1 ? 's' : ''}-clés`);
    checks.push({
      id: 'digital-metadata',
      category: 'digital',
      title: 'Métadonnées numériques',
      status: 'pass',
      message: parts.join(' · '),
    });
  }

  return checks;
}

/** Convenience: aggregate counts by status for a quick summary badge. */
export function summarizeConformity(checks: ConformityCheck[]): {
  errors: number;
  warnings: number;
  infos: number;
  passes: number;
  readyToExport: boolean;
} {
  const counts = checks.reduce(
    (acc, c) => {
      if (c.status === 'error') acc.errors++;
      else if (c.status === 'warning') acc.warnings++;
      else if (c.status === 'info') acc.infos++;
      else acc.passes++;
      return acc;
    },
    { errors: 0, warnings: 0, infos: 0, passes: 0 },
  );
  return { ...counts, readyToExport: counts.errors === 0 };
}
