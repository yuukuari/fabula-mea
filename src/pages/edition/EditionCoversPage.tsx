import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { CoverSection } from '@/components/edition/CoverSection';
import { useBookStore } from '@/store/useBookStore';
import { exportCoverTemplate } from '@/lib/export-cover-template';
import { DEFAULT_LAYOUT } from '@/lib/fonts';
import { estimatePageCount } from '@/lib/print-edition';
import { totalScenesCount } from '@/lib/utils';

export function EditionCoversPage() {
  const navigate = useNavigate();
  const layout = useBookStore((s) => s.layout);
  const title = useBookStore((s) => s.title);
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');

  const hasPrintEdition = !!layout?.printEdition;

  const handleDownloadTemplate = () => {
    const pe = layout?.printEdition;
    if (!pe) return;
    const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
    const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
    const totalWords = totalScenesCount(scenes, countUnit);
    const chapterCount = chapters.filter((c) => c.type === 'chapter').length;
    const pageCount = estimatePageCount(totalWords, pe.trimSize, fontSize, lineHeight, pe.margins, chapterCount);
    exportCoverTemplate(layout, title || 'Livre', pageCount);
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

      {/* Cover template download */}
      {hasPrintEdition && (
        <div className="card-fantasy p-6 mt-6">
          <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Gabarit de couverture</h3>
          <p className="text-sm text-ink-300 mb-4">
            Téléchargez un PDF aux dimensions exactes de votre couverture dépliée (4ème + dos + 1ère + fond perdu).
            Il contient les guides visuels (zones de coupe, de sécurité, du dos) à utiliser comme base dans
            Photoshop, GIMP, Canva ou Affinity Designer.
          </p>
          <button
            onClick={handleDownloadTemplate}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Télécharger le gabarit
          </button>
        </div>
      )}
    </div>
  );
}
