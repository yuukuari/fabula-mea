import { useNavigate } from 'react-router-dom';
import { Type, Image as ImageIcon, Printer, Smartphone, Download, CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useReaderStore } from '@/store/useReaderStore';
import { BookPreview3D } from '@/components/edition/BookPreview3D';
import { DEFAULT_LAYOUT } from '@/lib/fonts';

interface StepCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  complete: boolean;
  onClick: () => void;
}

function StepCard({ icon: Icon, title, description, complete, onClick }: StepCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-parchment-200 hover:border-bordeaux-300 hover:bg-bordeaux-50/30 transition-all text-left"
    >
      <div className="w-10 h-10 bg-bordeaux-50 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-bordeaux-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-display font-semibold text-ink-500 text-sm">{title}</p>
          {complete ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-ink-200 shrink-0" />
          )}
        </div>
        <p className="text-xs text-ink-300 mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-ink-300 shrink-0" />
    </button>
  );
}

export function EditionOverviewPage() {
  const navigate = useNavigate();
  const layout = useBookStore((s) => s.layout);
  const chapters = useBookStore((s) => s.chapters);
  const openReader = useReaderStore((s) => s.openReader);

  const hasLayout = !!layout?.fontFamily;
  const hasCovers = !!(layout?.coverFront || layout?.coverBack);
  const hasPrintEdition = !!layout?.printEdition;
  const digital = layout?.digitalEdition;
  const hasDigitalEdition = !!(digital?.description || (digital?.keywords && digital.keywords.length > 0) || digital?.isbnDigital || digital?.publisher);
  const hasContent = chapters.length > 0;

  const fontFamily = layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily;
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;

  return (
    <div className="page-container max-w-3xl">
      <h2 className="section-title mb-2">Édition</h2>
      <p className="text-sm text-ink-300 mb-6">
        Préparez votre livre pour l'impression ou la publication numérique.
      </p>

      {/* Progression */}
      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-4">Étapes de préparation</h3>
        <div className="space-y-2">
          <StepCard
            icon={Type}
            title="Mise en page"
            description={hasLayout ? `${fontFamily} · ${fontSize} pt · interligne ${lineHeight}` : 'Police, taille, interligne'}
            complete={hasLayout}
            onClick={() => navigate('/edition/layout')}
          />
          <StepCard
            icon={ImageIcon}
            title="Couvertures"
            description={hasCovers ? 'Couvertures ajoutées' : 'Ajouter les couvertures'}
            complete={hasCovers}
            onClick={() => navigate('/edition/covers')}
          />
          <StepCard
            icon={Printer}
            title="Édition papier"
            description={hasPrintEdition ? `Format ${layout?.printEdition?.trimSize ?? 'A5'}` : 'Format, papier, marges, ISBN'}
            complete={hasPrintEdition}
            onClick={() => navigate('/edition/print')}
          />
          <StepCard
            icon={Smartphone}
            title="Édition numérique"
            description={
              hasDigitalEdition
                ? [
                    digital?.keywords && digital.keywords.length > 0 ? `${digital.keywords.length} mots-clés` : null,
                    digital?.isbnDigital ? `ISBN ${digital.isbnDigital}` : null,
                    digital?.language ? `langue ${digital.language}` : null,
                  ].filter(Boolean).join(' · ') || 'Métadonnées renseignées'
                : 'Métadonnées EPUB, mots-clés, ISBN numérique'
            }
            complete={hasDigitalEdition}
            onClick={() => navigate('/edition/digital')}
          />
          <StepCard
            icon={Download}
            title="Export"
            description={hasContent ? 'EPUB, PDF, DOCX' : 'Aucun contenu à exporter'}
            complete={false}
            onClick={() => navigate('/edition/export')}
          />
        </div>
      </div>

      {/* Book preview */}
      <BookPreview3D onOpenReader={openReader} />
    </div>
  );
}
