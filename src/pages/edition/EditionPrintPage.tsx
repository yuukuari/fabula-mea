import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Printer, CheckCircle2, Pencil } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { DEFAULT_LAYOUT } from '@/lib/fonts';
import {
  DEFAULT_PRINT_EDITION, getTrimSize, getPaperType,
  estimatePageCount, calculateSpineWidth, calculateCoverDimensions,
} from '@/lib/print-edition';
import { totalScenesCount } from '@/lib/utils';
import type { PrintEdition } from '@/types';
import { StepTrimSize } from '@/components/edition/wizard/StepTrimSize';
import { StepInterior } from '@/components/edition/wizard/StepInterior';
import { StepCover } from '@/components/edition/wizard/StepCover';
import { StepMetadata } from '@/components/edition/wizard/StepMetadata';
import { PrintHelpModal, HelpTrigger, type HelpTopic } from '@/components/edition/PrintHelpModal';

interface SectionProps {
  number: number;
  title: string;
  summary: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ number, title, summary, expanded, onToggle, children }: SectionProps) {
  return (
    <div className="card-fantasy overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-parchment-50/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-bordeaux-100 text-bordeaux-500 flex items-center justify-center font-bold text-sm shrink-0">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-ink-500">{title}</p>
          {!expanded && <div className="text-xs text-ink-300 mt-0.5">{summary}</div>}
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-ink-300 shrink-0" />
        ) : (
          <>
            <span className="hidden sm:flex items-center gap-1 text-xs text-bordeaux-400 hover:text-bordeaux-600 shrink-0 mr-2">
              <Pencil className="w-3 h-3" />
              Modifier
            </span>
            <ChevronRight className="w-5 h-5 text-ink-300 shrink-0" />
          </>
        )}
      </button>
      {expanded && (
        <div className="p-6 pt-2 border-t border-parchment-200">
          {children}
        </div>
      )}
    </div>
  );
}

export function EditionPrintPage() {
  const navigate = useNavigate();
  const printEdition = useBookStore((s) => s.layout?.printEdition);
  const updatePrintEdition = useBookStore((s) => s.updatePrintEdition);

  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const layout = useBookStore((s) => s.layout);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');

  const hasConfigured = !!printEdition;
  const draft: PrintEdition = printEdition ?? DEFAULT_PRINT_EDITION;

  const [expanded, setExpanded] = useState<number | null>(hasConfigured ? null : 0);
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);

  const handleChange = (data: Partial<PrintEdition>) => {
    updatePrintEdition(data);
  };

  const toggle = (i: number) => setExpanded((prev) => (prev === i ? null : i));

  // Compute preview values
  const trim = getTrimSize(draft.trimSize);
  const paper = getPaperType(draft.paperType);
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const totalWords = totalScenesCount(scenes, countUnit);
  const chapterCount = chapters.filter((c) => c.type === 'chapter').length;
  const pageCount = estimatePageCount(totalWords, draft.trimSize, fontSize, lineHeight, draft.margins, chapterCount);
  const spineWidth = calculateSpineWidth(pageCount, draft.paperType);
  const coverDims = calculateCoverDimensions(draft.trimSize, pageCount, draft.paperType, draft.bleedMm);
  const m = draft.margins;

  return (
    <div className="page-container max-w-3xl">
      <button
        onClick={() => navigate('/edition')}
        className="flex items-center gap-2 text-sm text-ink-300 hover:text-bordeaux-500 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à l'édition
      </button>

      <h2 className="section-title mb-2">Édition papier</h2>
      <p className="text-sm text-ink-300 mb-6">
        Configurez les paramètres spécifiques à l'impression : format, papier, marges, ISBN.
        Vos choix sont enregistrés automatiquement et utilisés pour générer un PDF prêt à imprimer.
      </p>

      {!hasConfigured && (
        <div className="card-fantasy p-4 mb-4 border-bordeaux-200 bg-bordeaux-50/40">
          <div className="flex items-start gap-3">
            <Printer className="w-5 h-5 text-bordeaux-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ink-500">Configuration non terminée</p>
              <p className="text-xs text-ink-300 mt-0.5">
                Parcourez les 4 sections ci-dessous pour préparer votre livre à l'impression.
                Les valeurs par défaut (A5, blanc 80g) sont appliquées tant que vous n'avez rien modifié.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <CollapsibleSection
          number={1}
          title="Format"
          summary={<span><b>{trim.label}</b> — {trim.widthMm} × {trim.heightMm} mm · environ {pageCount} pages</span>}
          expanded={expanded === 0}
          onToggle={() => toggle(0)}
        >
          <StepTrimSize draft={draft} onChange={handleChange} />
        </CollapsibleSection>

        <CollapsibleSection
          number={2}
          title="Intérieur"
          summary={<span><b>{paper.label}</b> · marges {m.topMm}/{m.bottomMm}/{m.innerMm}/{m.outerMm} mm</span>}
          expanded={expanded === 1}
          onToggle={() => toggle(1)}
        >
          <div className="flex justify-end mb-3">
            <HelpTrigger topic="safety" label="Comprendre les marges de sécurité" onClick={setHelpTopic} />
          </div>
          <StepInterior draft={draft} onChange={handleChange} />
        </CollapsibleSection>

        <CollapsibleSection
          number={3}
          title="Couverture"
          summary={<span>Fond perdu <b>{draft.bleedMm} mm</b> · dos <b>{spineWidth} mm</b> · total {coverDims.totalWidthMm} × {coverDims.totalHeightMm} mm</span>}
          expanded={expanded === 2}
          onToggle={() => toggle(2)}
        >
          <div className="flex justify-end gap-3 mb-3">
            <HelpTrigger topic="bleed" label="Comprendre les fonds perdus" onClick={setHelpTopic} />
            <HelpTrigger topic="flat-cover" label="Couverture à plat" onClick={setHelpTopic} />
          </div>
          <StepCover draft={draft} onChange={handleChange} />
        </CollapsibleSection>

        <CollapsibleSection
          number={4}
          title="Métadonnées"
          summary={
            <span>
              {draft.isbn ? <>ISBN <b>{draft.isbn}</b></> : 'Aucune métadonnée renseignée'}
              {draft.publisher && <> · {draft.publisher}</>}
            </span>
          }
          expanded={expanded === 3}
          onToggle={() => toggle(3)}
        >
          <StepMetadata draft={draft} onChange={handleChange} />
        </CollapsibleSection>
      </div>

      {/* Live preview summary */}
      <div className="card-fantasy p-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <h3 className="font-display text-lg font-semibold text-ink-500">Récapitulatif</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <PreviewCell label="Format" value={trim.label} sub={`${trim.widthMm} × ${trim.heightMm} mm`} />
          <PreviewCell label="Pages estimées" value={`~${pageCount}`} sub="pages" />
          <PreviewCell label="Largeur du dos" value={`${spineWidth}`} sub="mm" />
          <PreviewCell label="Couverture à plat" value={`${coverDims.totalWidthMm} × ${coverDims.totalHeightMm}`} sub="mm" />
        </div>
      </div>

      {helpTopic && <PrintHelpModal topic={helpTopic} onClose={() => setHelpTopic(null)} />}
    </div>
  );
}

function PreviewCell({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-300 mb-1">{label}</p>
      <p className="text-lg font-display font-semibold text-ink-500">{value}</p>
      {sub && <p className="text-xs text-ink-200">{sub}</p>}
    </div>
  );
}
