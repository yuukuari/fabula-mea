import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileText, FileType, Printer, Package } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { exportEpub } from '@/lib/export-epub';
import { exportPdf } from '@/lib/export-pdf';
import { exportDocx } from '@/lib/export-docx';
import { exportPrinterBrief } from '@/lib/export-printer-brief';
import { checkConformity, summarizeConformity } from '@/lib/conformity';
import { ConformityReport } from '@/components/edition/ConformityReport';
import { totalScenesCount } from '@/lib/utils';
import { resolveCoverForExport } from '@/lib/cover-for-export';

export function EditionExportPage() {
  const navigate = useNavigate();
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);
  const genre = useBookStore((s) => s.genre);
  const synopsis = useBookStore((s) => s.synopsis);
  const layout = useBookStore((s) => s.layout);
  const tableOfContents = useBookStore((s) => s.tableOfContents ?? false);
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const countUnit = useBookStore((s) => s.countUnit);
  const glossaryEnabled = useBookStore((s) => s.glossaryEnabled);
  const { characters: allCharacters, places: allPlaces, worldNotes: allWorldNotes, maps: allMaps } = useEncyclopediaStore();

  // Conformity checks
  const checks = useMemo(
    () => checkConformity({ title, author, chapters, scenes, countUnit, layout, glossaryEnabled, tableOfContents }),
    [title, author, chapters, scenes, countUnit, layout, glossaryEnabled, tableOfContents],
  );
  const summary = summarizeConformity(checks);

  const buildExportBook = async () => {
    // Pre-resolve covers (handles advanced-mode cropping to front/back).
    const [resolvedCoverFront, resolvedCoverBack] = await Promise.all([
      resolveCoverForExport(layout, 'front', scenes, chapters, countUnit ?? 'words'),
      resolveCoverForExport(layout, 'back', scenes, chapters, countUnit ?? 'words'),
    ]);
    const glossary = glossaryEnabled
      ? [
          ...allCharacters.filter((c) => c.inGlossary).map((c) => ({ name: c.name, type: 'character', description: c.description || '' })),
          ...allPlaces.filter((p) => p.inGlossary).map((p) => ({ name: p.name, type: 'place', description: p.description || '' })),
          ...allWorldNotes.filter((w) => w.inGlossary).map((w) => ({ name: w.title, type: 'worldNote', description: w.content || '' })),
        ].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      : [];

    return {
      title,
      author,
      genre: genre ?? '',
      synopsis: synopsis ?? '',
      chapters: [...chapters]
        .sort((a, b) => a.number - b.number)
        .map((ch) => ({
          id: ch.id,
          number: ch.number,
          title: ch.title ?? '',
          type: ch.type,
          scenes: ch.sceneIds
            .map((sid) => scenes.find((s) => s.id === sid))
            .filter(Boolean)
            .sort((a, b) => a!.orderInChapter - b!.orderInChapter)
            .map((s) => ({ title: s!.title ?? '', content: s!.content ?? '' })),
        })),
      ...(glossary.length > 0 ? { glossary } : {}),
      ...(layout ? { layout } : {}),
      tableOfContents,
      ...(resolvedCoverFront ? { resolvedCoverFront } : {}),
      ...(resolvedCoverBack ? { resolvedCoverBack } : {}),
      maps: allMaps
        .filter((m) => m.imageUrl)
        .map((m) => ({ id: m.id, name: m.name, imageUrl: m.imageUrl })),
    };
  };

  const handleExportEpub = async () => {
    try {
      await exportEpub(await buildExportBook());
    } catch (err) {
      console.error('[Export EPUB]', err);
      alert("Erreur lors de l'export EPUB. Vérifiez la console.");
    }
  };

  const handleExportPdf = async () => {
    exportPdf(await buildExportBook());
  };

  const handleExportPdfPrintReady = async () => {
    exportPdf(await buildExportBook(), { printReady: true });
  };

  const handleExportPrinterBrief = () => {
    const wordCount = totalScenesCount(scenes, countUnit ?? 'words');
    const chapterCount = chapters.filter((c) => c.type === 'chapter').length;
    exportPrinterBrief({ title, author, genre, layout, wordCount, chapterCount });
  };

  const handleExportDocx = async () => {
    try {
      await exportDocx(await buildExportBook());
    } catch (err) {
      console.error('[Export DOCX]', err);
      alert("Erreur lors de l'export DOCX. Vérifiez la console.");
    }
  };

  return (
    <div className="page-container max-w-2xl">
      <button
        onClick={() => navigate('/edition')}
        className="flex items-center gap-2 text-sm text-ink-300 hover:text-bordeaux-500 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à l'édition
      </button>

      <h2 className="section-title mb-2">Export</h2>
      <p className="text-sm text-ink-300 mb-6">
        Téléchargez votre livre dans un format standard, prêt à être lu sur une liseuse,
        imprimé, ou partagé avec votre éditeur.
      </p>

      {/* Conformity report */}
      <ConformityReport checks={checks} />

      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-300 mb-2 mt-2">
        Formats numériques & partage
      </h3>
      <div className="card-fantasy p-6">
        <p className="text-sm text-ink-300 mb-4">
          Formats adaptés à la lecture sur liseuse, au partage avec vos relecteurs ou à la retouche par un éditeur.
          Utilise vos paramètres de mise en page, couvertures et métadonnées numériques.
          {summary.errors > 0 && (
            <span className="block mt-2 text-xs text-red-600">
              ⚠ {summary.errors} erreur{summary.errors > 1 ? 's' : ''} détectée{summary.errors > 1 ? 's' : ''} dans le rapport ci-dessus. L'export reste possible mais le résultat pourrait être incomplet.
            </span>
          )}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleExportEpub}
            disabled={chapters.length === 0}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-parchment-200 hover:border-bordeaux-300 hover:bg-bordeaux-50/30 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-parchment-200 disabled:hover:bg-transparent"
          >
            <div className="w-10 h-10 bg-bordeaux-100 rounded-lg flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-bordeaux-500" />
            </div>
            <div>
              <p className="font-display font-semibold text-ink-500 text-sm">EPUB</p>
              <p className="text-xs text-ink-300 mt-0.5">Liseuses, Kindle, Apple Books</p>
            </div>
          </button>
          <button
            onClick={handleExportPdf}
            disabled={chapters.length === 0}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-parchment-200 hover:border-bordeaux-300 hover:bg-bordeaux-50/30 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-parchment-200 disabled:hover:bg-transparent"
          >
            <div className="w-10 h-10 bg-bordeaux-100 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-bordeaux-500" />
            </div>
            <div>
              <p className="font-display font-semibold text-ink-500 text-sm">PDF de lecture</p>
              <p className="text-xs text-ink-300 mt-0.5">Partage, relecture, email</p>
            </div>
          </button>
          <button
            onClick={handleExportDocx}
            disabled={chapters.length === 0}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-parchment-200 hover:border-bordeaux-300 hover:bg-bordeaux-50/30 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-parchment-200 disabled:hover:bg-transparent"
          >
            <div className="w-10 h-10 bg-bordeaux-100 rounded-lg flex items-center justify-center shrink-0">
              <FileType className="w-5 h-5 text-bordeaux-500" />
            </div>
            <div>
              <p className="font-display font-semibold text-ink-500 text-sm">DOCX</p>
              <p className="text-xs text-ink-300 mt-0.5">Word, Google Docs, LibreOffice</p>
            </div>
          </button>
        </div>
        {chapters.length === 0 && (
          <p className="text-xs text-ink-200 mt-3 italic">
            Ajoutez des chapitres et des scènes pour pouvoir exporter votre livre.
          </p>
        )}
      </div>

      {/* Print-ready section — only when print edition is configured */}
      {layout?.printEdition && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-300 mb-2 mt-6">
            Impression papier
          </h3>
          <p className="text-xs text-ink-300 mb-3">
            Variante du PDF aux dimensions exactes de votre édition papier, avec pages techniques automatiques,
            plus un dossier récapitulatif à joindre à votre commande d'impression.
          </p>
        </>
      )}

      {layout?.printEdition && (
        <div className="card-fantasy p-6 border-bordeaux-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-bordeaux-500 rounded-lg flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">PDF prêt à imprimer</h3>
              <p className="text-sm text-ink-300 mb-4">
                Génère un PDF aux dimensions exactes de votre édition papier, avec les pages techniques
                ajoutées automatiquement (page blanche après la couverture, page de copyright avec ISBN et
                dépôt légal, page blanche avant la 4ème de couverture). Ce fichier peut être envoyé tel quel
                à un imprimeur comme Coollibri, KDP ou IngramSpark.
              </p>
              <button
                onClick={handleExportPdfPrintReady}
                disabled={chapters.length === 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Générer le PDF prêt à imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printer briefing — only when print edition is configured */}
      {layout?.printEdition && (
        <div className="card-fantasy p-6 mt-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-gold-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Dossier imprimeur</h3>
              <p className="text-sm text-ink-300 mb-4">
                Document récapitulatif (PDF) à joindre à votre commande d'impression : caractéristiques
                techniques complètes, checklist des fichiers, et instructions spécifiques aux plateformes
                (Coollibri, KDP, IngramSpark, Lulu). À envoyer avec le PDF intérieur et le PDF couverture.
              </p>
              <button
                onClick={handleExportPrinterBrief}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Générer le dossier imprimeur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
