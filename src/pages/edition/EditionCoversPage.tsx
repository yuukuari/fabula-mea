import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileDown } from 'lucide-react';
import { CoverSection } from '@/components/edition/CoverSection';
import { useBookStore } from '@/store/useBookStore';
import { exportCoverTemplate } from '@/lib/export-cover-template';
import { exportCoverFinal } from '@/lib/export-cover-final';
import { DEFAULT_LAYOUT } from '@/lib/fonts';
import { estimatePageCount } from '@/lib/print-edition';
import { totalScenesCount, isSpecialChapter } from '@/lib/utils';

export function EditionCoversPage() {
  const navigate = useNavigate();
  const layout = useBookStore((s) => s.layout);
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');

  const hasPrintEdition = !!layout?.printEdition;
  const wordCount = totalScenesCount(scenes, countUnit);
  const chapterCount = chapters.filter((c) => !isSpecialChapter(c)).length;

  const handleDownloadTemplate = () => {
    const pe = layout?.printEdition;
    if (!pe) return;
    const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
    const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
    const pageCount = estimatePageCount(wordCount, pe.trimSize, fontSize, lineHeight, pe.margins, chapterCount);
    exportCoverTemplate(layout, title || 'Livre', pageCount);
  };

  const handleDownloadFinal = () => {
    exportCoverFinal({ layout, title, author, wordCount, chapterCount });
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

      <h2 className="section-title mb-2">Couvertures</h2>
      <p className="text-sm text-ink-300 mb-6">
        Images utilisées pour la 1ère et la 4ème de couverture. Si vous configurez une édition papier,
        les dimensions recommandées pour chaque zone sont affichées.
      </p>

      <CoverSection />

      {/* Cover exports */}
      {hasPrintEdition && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Final print-ready cover */}
          <div className="card-fantasy p-6 border-bordeaux-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-bordeaux-500 rounded-lg flex items-center justify-center shrink-0">
                <FileDown className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-ink-500 mb-1">Couverture finale</h3>
                <p className="text-xs text-ink-300 mb-3">
                  PDF de la couverture dépliée prête à envoyer à l'imprimeur, aux dimensions exactes avec
                  1ère + dos + 4ème composés automatiquement selon le mode choisi.
                </p>
                <button onClick={handleDownloadFinal} className="btn-primary text-sm inline-flex items-center gap-2">
                  <FileDown className="w-4 h-4" />
                  Générer la couverture finale
                </button>
              </div>
            </div>
          </div>

          {/* Empty template */}
          <div className="card-fantasy p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-gold-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-ink-500 mb-1">Gabarit vierge</h3>
                <p className="text-xs text-ink-300 mb-3">
                  PDF avec uniquement les guides visuels (fond perdu, zone sécurité, dos) à utiliser comme
                  base dans Photoshop, GIMP, Canva…
                </p>
                <button onClick={handleDownloadTemplate} className="btn-secondary text-sm inline-flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Télécharger le gabarit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
